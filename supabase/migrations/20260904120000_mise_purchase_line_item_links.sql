-- Manager-verified purchase-line → inventory-item identity links.
-- Invoice keys never auto-bind. Exact normalized-key suggestions live in the
-- TypeScript domain; this migration stores only explicit manager decisions and
-- an optional unit-cost apply from the newest confirmed linked purchase line.

create table if not exists public.purchase_line_item_links (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid,
  supplier_scope uuid generated always as (
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  normalized_item_key text not null check (
    pg_catalog.length(pg_catalog.btrim(normalized_item_key)) between 1 and 500
    and normalized_item_key !~ '[[:cntrl:]]'
  ),
  inventory_item_id uuid not null,
  status text not null check (status in ('verified', 'revoked')),
  evidence_version text not null default 'mise.purchase_line_item_link.v1'
    check (evidence_version = 'mise.purchase_line_item_link.v1'),
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint purchase_line_item_links_restaurant_id_id_key unique (restaurant_id, id),
  constraint purchase_line_item_links_supplier_fkey foreign key (restaurant_id, supplier_id)
    references public.suppliers (restaurant_id, id) on delete no action,
  constraint purchase_line_item_links_inventory_fkey foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete no action,
  constraint purchase_line_item_links_revoke_state_check check (
    (status = 'verified' and revoked_by is null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create unique index if not exists purchase_line_item_links_active_key_idx
on public.purchase_line_item_links (restaurant_id, supplier_scope, normalized_item_key)
where status = 'verified';

create index if not exists purchase_line_item_links_item_idx
on public.purchase_line_item_links (restaurant_id, inventory_item_id, linked_at desc);

comment on table public.purchase_line_item_links is
  'Manager-verified binding from a purchase-line normalized item key to a same-tenant inventory item. Never inferred.';

alter table public.purchase_line_item_links enable row level security;

drop policy if exists "Members can read purchase line item links" on public.purchase_line_item_links;
create policy "Members can read purchase line item links"
on public.purchase_line_item_links for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.purchase_line_item_links from public, anon, authenticated, service_role;
grant select on public.purchase_line_item_links to authenticated;
grant select, insert, update on table public.purchase_line_item_links to service_role;

-- Additive activity vocabulary for link and cost-apply evidence.
alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'task_reopened', 'task_unblocked',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded',
    'purchase_lines_recorded', 'purchase_line_confidence_downgraded',
    'purchase_line_item_linked', 'purchase_line_item_link_revoked',
    'purchase_line_linked_unit_cost_applied'
  ));

create or replace function public.link_purchase_line_item(
  p_restaurant_id uuid,
  p_normalized_item_key text,
  p_inventory_item_id uuid,
  p_supplier_id uuid default null
)
returns public.purchase_line_item_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_key text := pg_catalog.btrim(coalesce(p_normalized_item_key, ''));
  inventory_row public.inventory_items%rowtype;
  supplier_ok boolean := false;
  existing_row public.purchase_line_item_links%rowtype;
  link_row public.purchase_line_item_links%rowtype;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if pg_catalog.length(normalized_key) < 1
    or pg_catalog.length(normalized_key) > 500
    or normalized_key ~ '[[:cntrl:]]'
  then
    raise exception 'Normalized purchase item key is invalid' using errcode = '22023';
  end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f'
        || 'purchase_line_item_link'
        || E'\x1f'
        || coalesce(p_supplier_id::text, '00000000-0000-0000-0000-000000000000')
        || E'\x1f'
        || normalized_key,
      0
    )
  );

  select * into inventory_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  if p_supplier_id is not null then
    select true into supplier_ok
    from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = p_supplier_id;
    if not coalesce(supplier_ok, false) then
      raise exception 'Supplier identity is not available for this restaurant'
        using errcode = '23503';
    end if;
  end if;

  select * into existing_row
  from public.purchase_line_item_links link
  where link.restaurant_id = p_restaurant_id
    and link.supplier_id is not distinct from p_supplier_id
    and link.normalized_item_key = normalized_key
    and link.status = 'verified'
  for update;

  if found then
    if existing_row.inventory_item_id = p_inventory_item_id then
      return existing_row;
    end if;

    update public.purchase_line_item_links link
    set status = 'revoked',
      revoked_by = actor_user_id,
      revoked_at = decision_time
    where link.id = existing_row.id
      and link.restaurant_id = p_restaurant_id
      and link.status = 'verified';
  end if;

  insert into public.purchase_line_item_links (
    restaurant_id,
    supplier_id,
    normalized_item_key,
    inventory_item_id,
    status,
    linked_by,
    linked_at
  ) values (
    p_restaurant_id,
    p_supplier_id,
    normalized_key,
    p_inventory_item_id,
    'verified',
    actor_user_id,
    decision_time
  )
  returning * into link_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_item_linked',
    'purchase_line_item_links',
    link_row.id,
    pg_catalog.jsonb_build_object(
      'normalized_item_key', normalized_key,
      'inventory_item_id', p_inventory_item_id,
      'supplier_id', p_supplier_id,
      'replaced_link_id', existing_row.id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_item_linked',
    'inventory',
    'Purchase line linked to inventory',
    'A manager verified an invoice item key against an inventory item.',
    decision_time,
    'mise.purchase_line_item_links',
    'user',
    actor_user_id,
    'purchase_line_item_link',
    link_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    false,
    null::timestamptz,
    'inventory_item',
    p_inventory_item_id::text,
    null::text,
    link_row.id,
    null::uuid,
    'purchase_line_item_linked:' || link_row.id::text,
    pg_catalog.jsonb_build_object(
      'link_id', link_row.id,
      'normalized_item_key', normalized_key,
      'supplier_id', p_supplier_id
    )
  );

  return link_row;
end;
$$;

revoke all on function public.link_purchase_line_item(uuid, text, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.link_purchase_line_item(uuid, text, uuid, uuid)
to authenticated;

create or replace function public.revoke_purchase_line_item_link(
  p_restaurant_id uuid,
  p_link_id uuid
)
returns public.purchase_line_item_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  link_row public.purchase_line_item_links%rowtype;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_link_id is null then
    raise exception 'Purchase line item link is required' using errcode = '22023';
  end if;

  select * into link_row
  from public.purchase_line_item_links link
  where link.restaurant_id = p_restaurant_id
    and link.id = p_link_id
  for update;
  if not found then
    raise exception 'Purchase line item link not found' using errcode = 'P0002';
  end if;

  if link_row.status = 'revoked' then
    return link_row;
  end if;

  update public.purchase_line_item_links link
  set status = 'revoked',
    revoked_by = actor_user_id,
    revoked_at = decision_time
  where link.id = link_row.id
    and link.restaurant_id = p_restaurant_id
  returning * into link_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_item_link_revoked',
    'purchase_line_item_links',
    link_row.id,
    pg_catalog.jsonb_build_object(
      'normalized_item_key', link_row.normalized_item_key,
      'inventory_item_id', link_row.inventory_item_id,
      'supplier_id', link_row.supplier_id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_item_link_revoked',
    'inventory',
    'Purchase line inventory link revoked',
    'A manager revoked a verified invoice-to-inventory binding.',
    decision_time,
    'mise.purchase_line_item_links',
    'user',
    actor_user_id,
    'purchase_line_item_link_revoke',
    link_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'reversed',
    false,
    null::timestamptz,
    'inventory_item',
    link_row.inventory_item_id::text,
    null::text,
    link_row.id,
    null::uuid,
    'purchase_line_item_link_revoked:' || link_row.id::text || ':' || extract(epoch from decision_time)::text,
    pg_catalog.jsonb_build_object(
      'link_id', link_row.id,
      'normalized_item_key', link_row.normalized_item_key,
      'supplier_id', link_row.supplier_id
    )
  );

  return link_row;
end;
$$;

revoke all on function public.revoke_purchase_line_item_link(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.revoke_purchase_line_item_link(uuid, uuid)
to authenticated;

create or replace function public.apply_purchase_line_linked_unit_cost(
  p_restaurant_id uuid,
  p_link_id uuid
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  link_row public.purchase_line_item_links%rowtype;
  item_row public.inventory_items%rowtype;
  source_line public.purchase_lines%rowtype;
  previous_cost numeric;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_link_id is null then
    raise exception 'Purchase line item link is required' using errcode = '22023';
  end if;

  select * into link_row
  from public.purchase_line_item_links link
  where link.restaurant_id = p_restaurant_id
    and link.id = p_link_id
  for update;
  if not found or link_row.status <> 'verified' then
    raise exception 'Verified purchase line item link is required' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = link_row.inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  select line.*
  into source_line
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and line.supplier_id is not distinct from link_row.supplier_id
    and line.normalized_item_key = link_row.normalized_item_key
    and line.line_type = 'purchase'
    and line.parse_confidence = 'confirmed'
    and line.unit_price is not null
    and not exists (
      select 1
      from public.purchase_lines correction
      where correction.restaurant_id = line.restaurant_id
        and correction.supersedes_line_id = line.id
    )
  order by line.transaction_date desc, line.line_index desc, line.id desc
  limit 1;
  if not found then
    raise exception 'No confirmed purchase-line unit price is available for this link'
      using errcode = '22023';
  end if;

  if source_line.unit_price < 0 or source_line.unit_price > 1000000 then
    raise exception 'Purchase-line unit price is outside supported limits'
      using errcode = '22023';
  end if;

  previous_cost := item_row.estimated_unit_cost;
  if previous_cost is not distinct from source_line.unit_price then
    return item_row;
  end if;

  update public.inventory_items item
  set estimated_unit_cost = source_line.unit_price,
    last_updated = decision_time
  where item.restaurant_id = p_restaurant_id
    and item.id = item_row.id
  returning * into item_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_linked_unit_cost_applied',
    'inventory_items',
    item_row.id,
    pg_catalog.jsonb_build_object(
      'link_id', link_row.id,
      'purchase_line_id', source_line.id,
      'previous_estimated_unit_cost', previous_cost,
      'applied_unit_price', source_line.unit_price,
      'currency', source_line.currency,
      'normalized_item_key', link_row.normalized_item_key,
      'supplier_id', link_row.supplier_id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_linked_unit_cost_applied',
    'inventory',
    'Invoice unit cost applied',
    'A manager applied a confirmed invoice unit price onto inventory estimated cost.',
    decision_time,
    'mise.purchase_line_item_links',
    'user',
    actor_user_id,
    'purchase_line_linked_unit_cost_apply',
    link_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    false,
    null::timestamptz,
    'inventory_item',
    item_row.id::text,
    null::text,
    link_row.id,
    null::uuid,
    'purchase_line_linked_unit_cost:' || link_row.id::text || ':' || source_line.id::text || ':' || source_line.unit_price::text,
    pg_catalog.jsonb_build_object(
      'link_id', link_row.id,
      'purchase_line_id', source_line.id,
      'applied_unit_price', source_line.unit_price
    )
  );

  return item_row;
end;
$$;

revoke all on function public.apply_purchase_line_linked_unit_cost(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.apply_purchase_line_linked_unit_cost(uuid, uuid)
to authenticated;

comment on function public.link_purchase_line_item(uuid, text, uuid, uuid) is
  'Manager+ verifies a purchase-line normalized item key against a same-tenant inventory item. Never auto-binds.';
comment on function public.revoke_purchase_line_item_link(uuid, uuid) is
  'Manager+ revokes a verified purchase-line inventory binding.';
comment on function public.apply_purchase_line_linked_unit_cost(uuid, uuid) is
  'Manager+ applies the newest confirmed linked purchase-line unit price onto inventory estimated_unit_cost. Explicit only.';
