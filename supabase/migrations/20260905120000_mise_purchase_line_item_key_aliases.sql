-- Manager-verified purchase-line item-key aliases.
-- Exact key to exact key only. Never inferred. Nets apply one-hop aliases so a
-- credit memo that used different wording can join its invoice group without
-- rewriting append-only ledger text.

create table if not exists public.purchase_line_item_key_aliases (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_id uuid,
  supplier_scope uuid generated always as (
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  alias_item_key text not null check (
    pg_catalog.length(pg_catalog.btrim(alias_item_key)) between 1 and 500
    and alias_item_key !~ '[[:cntrl:]]'
  ),
  canonical_item_key text not null check (
    pg_catalog.length(pg_catalog.btrim(canonical_item_key)) between 1 and 500
    and canonical_item_key !~ '[[:cntrl:]]'
  ),
  status text not null check (status in ('verified', 'revoked')),
  evidence_version text not null default 'mise.purchase_line_item_key_alias.v1'
    check (evidence_version = 'mise.purchase_line_item_key_alias.v1'),
  aliased_by uuid references auth.users(id) on delete set null,
  aliased_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint purchase_line_item_key_aliases_restaurant_id_id_key unique (restaurant_id, id),
  constraint purchase_line_item_key_aliases_supplier_fkey foreign key (restaurant_id, supplier_id)
    references public.suppliers (restaurant_id, id) on delete no action,
  constraint purchase_line_item_key_aliases_keys_distinct_check check (
    alias_item_key <> canonical_item_key
  ),
  constraint purchase_line_item_key_aliases_revoke_state_check check (
    (status = 'verified' and revoked_by is null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create unique index if not exists purchase_line_item_key_aliases_active_key_idx
on public.purchase_line_item_key_aliases (restaurant_id, supplier_scope, alias_item_key)
where status = 'verified';

create index if not exists purchase_line_item_key_aliases_canonical_idx
on public.purchase_line_item_key_aliases (restaurant_id, supplier_scope, canonical_item_key)
where status = 'verified';

comment on table public.purchase_line_item_key_aliases is
  'Manager-verified exact alias from one purchase-line normalized item key to another within a restaurant and supplier scope. Never inferred.';

alter table public.purchase_line_item_key_aliases enable row level security;

drop policy if exists "Members can read purchase line item key aliases"
on public.purchase_line_item_key_aliases;
create policy "Members can read purchase line item key aliases"
on public.purchase_line_item_key_aliases for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.purchase_line_item_key_aliases
from public, anon, authenticated, service_role;
grant select on public.purchase_line_item_key_aliases to authenticated;
grant select, insert, update on table public.purchase_line_item_key_aliases to service_role;

-- Additive activity vocabulary. Includes sibling purchase-line item-link events
-- so either migration order keeps the allowlist complete on rebase.
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
    'purchase_line_linked_unit_cost_applied',
    'purchase_line_item_key_aliased', 'purchase_line_item_key_alias_revoked'
  ));

create or replace function private.resolve_purchase_line_item_key(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_normalized_item_key text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select alias.canonical_item_key
      from public.purchase_line_item_key_aliases alias
      where alias.restaurant_id = p_restaurant_id
        and alias.supplier_id is not distinct from p_supplier_id
        and alias.alias_item_key = p_normalized_item_key
        and alias.status = 'verified'
      limit 1
    ),
    p_normalized_item_key
  );
$$;

revoke all on function private.resolve_purchase_line_item_key(uuid, uuid, text)
from public, anon, authenticated, service_role;

comment on function private.resolve_purchase_line_item_key(uuid, uuid, text) is
  'One-hop manager-verified item-key alias resolution. Never inferred and never transitive.';

create or replace function public.alias_purchase_line_item_key(
  p_restaurant_id uuid,
  p_alias_item_key text,
  p_canonical_item_key text,
  p_supplier_id uuid default null
)
returns public.purchase_line_item_key_aliases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  alias_key text := pg_catalog.btrim(coalesce(p_alias_item_key, ''));
  canonical_key text := pg_catalog.btrim(coalesce(p_canonical_item_key, ''));
  supplier_ok boolean := false;
  existing_row public.purchase_line_item_key_aliases%rowtype;
  alias_row public.purchase_line_item_key_aliases%rowtype;
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

  if pg_catalog.length(alias_key) < 1
    or pg_catalog.length(alias_key) > 500
    or alias_key ~ '[[:cntrl:]]'
    or pg_catalog.length(canonical_key) < 1
    or pg_catalog.length(canonical_key) > 500
    or canonical_key ~ '[[:cntrl:]]'
  then
    raise exception 'Normalized purchase item key is invalid' using errcode = '22023';
  end if;

  if alias_key = canonical_key then
    raise exception 'Alias and canonical purchase item keys must differ'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f'
        || 'purchase_line_item_key_alias'
        || E'\x1f'
        || coalesce(p_supplier_id::text, '00000000-0000-0000-0000-000000000000')
        || E'\x1f'
        || alias_key,
      0
    )
  );

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

  -- Fail closed on chains and cycles: one-hop aliases only.
  if exists (
    select 1
    from public.purchase_line_item_key_aliases alias
    where alias.restaurant_id = p_restaurant_id
      and alias.supplier_id is not distinct from p_supplier_id
      and alias.status = 'verified'
      and alias.alias_item_key = canonical_key
  ) then
    raise exception 'Canonical purchase item key is already an alias source'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.purchase_line_item_key_aliases alias
    where alias.restaurant_id = p_restaurant_id
      and alias.supplier_id is not distinct from p_supplier_id
      and alias.status = 'verified'
      and alias.canonical_item_key = alias_key
  ) then
    raise exception 'Alias purchase item key is already a canonical target'
      using errcode = '22023';
  end if;

  select * into existing_row
  from public.purchase_line_item_key_aliases alias
  where alias.restaurant_id = p_restaurant_id
    and alias.supplier_id is not distinct from p_supplier_id
    and alias.alias_item_key = alias_key
    and alias.status = 'verified'
  for update;

  if found then
    if existing_row.canonical_item_key = canonical_key then
      return existing_row;
    end if;

    update public.purchase_line_item_key_aliases alias
    set status = 'revoked',
      revoked_by = actor_user_id,
      revoked_at = decision_time
    where alias.id = existing_row.id
      and alias.restaurant_id = p_restaurant_id
      and alias.status = 'verified';
  end if;

  insert into public.purchase_line_item_key_aliases (
    restaurant_id,
    supplier_id,
    alias_item_key,
    canonical_item_key,
    status,
    aliased_by,
    aliased_at
  ) values (
    p_restaurant_id,
    p_supplier_id,
    alias_key,
    canonical_key,
    'verified',
    actor_user_id,
    decision_time
  )
  returning * into alias_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_item_key_aliased',
    'purchase_line_item_key_aliases',
    alias_row.id,
    pg_catalog.jsonb_build_object(
      'alias_item_key', alias_key,
      'canonical_item_key', canonical_key,
      'supplier_id', p_supplier_id,
      'replaced_alias_id', existing_row.id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_item_key_aliased',
    'inventory',
    'Purchase line item key aliased',
    'A manager verified that one invoice item key means another for netting.',
    decision_time,
    'mise.purchase_line_item_key_aliases',
    'user',
    actor_user_id,
    'purchase_line_item_key_alias',
    alias_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    false,
    null::timestamptz,
    'purchase_line_item_key_alias',
    alias_row.id::text,
    null::text,
    alias_row.id,
    null::uuid,
    'purchase_line_item_key_aliased:' || alias_row.id::text,
    pg_catalog.jsonb_build_object(
      'alias_id', alias_row.id,
      'alias_item_key', alias_key,
      'canonical_item_key', canonical_key,
      'supplier_id', p_supplier_id
    )
  );

  return alias_row;
end;
$$;

revoke all on function public.alias_purchase_line_item_key(uuid, text, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.alias_purchase_line_item_key(uuid, text, text, uuid)
to authenticated;

create or replace function public.revoke_purchase_line_item_key_alias(
  p_restaurant_id uuid,
  p_alias_id uuid
)
returns public.purchase_line_item_key_aliases
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  alias_row public.purchase_line_item_key_aliases%rowtype;
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

  if p_alias_id is null then
    raise exception 'Purchase line item key alias is required' using errcode = '22023';
  end if;

  select * into alias_row
  from public.purchase_line_item_key_aliases alias
  where alias.restaurant_id = p_restaurant_id
    and alias.id = p_alias_id
  for update;
  if not found then
    raise exception 'Purchase line item key alias not found' using errcode = 'P0002';
  end if;

  if alias_row.status = 'revoked' then
    return alias_row;
  end if;

  update public.purchase_line_item_key_aliases alias
  set status = 'revoked',
    revoked_by = actor_user_id,
    revoked_at = decision_time
  where alias.id = alias_row.id
    and alias.restaurant_id = p_restaurant_id
  returning * into alias_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_item_key_alias_revoked',
    'purchase_line_item_key_aliases',
    alias_row.id,
    pg_catalog.jsonb_build_object(
      'alias_item_key', alias_row.alias_item_key,
      'canonical_item_key', alias_row.canonical_item_key,
      'supplier_id', alias_row.supplier_id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_item_key_alias_revoked',
    'inventory',
    'Purchase line item key alias revoked',
    'A manager revoked a verified invoice item-key alias.',
    decision_time,
    'mise.purchase_line_item_key_aliases',
    'user',
    actor_user_id,
    'purchase_line_item_key_alias_revoke',
    alias_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'reversed',
    false,
    null::timestamptz,
    'purchase_line_item_key_alias',
    alias_row.id::text,
    null::text,
    alias_row.id,
    null::uuid,
    'purchase_line_item_key_alias_revoked:' || alias_row.id::text || ':'
      || extract(epoch from decision_time)::text,
    pg_catalog.jsonb_build_object(
      'alias_id', alias_row.id,
      'alias_item_key', alias_row.alias_item_key,
      'canonical_item_key', alias_row.canonical_item_key,
      'supplier_id', alias_row.supplier_id
    )
  );

  return alias_row;
end;
$$;

revoke all on function public.revoke_purchase_line_item_key_alias(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.revoke_purchase_line_item_key_alias(uuid, uuid)
to authenticated;

comment on function public.alias_purchase_line_item_key(uuid, text, text, uuid) is
  'Manager+ verifies that one exact purchase-line item key means another within supplier scope. Never inferred.';
comment on function public.revoke_purchase_line_item_key_alias(uuid, uuid) is
  'Manager+ revokes a verified purchase-line item-key alias.';

-- Nets apply one-hop aliases. Unmatched credits remain visible when no purchase
-- shares the resolved key. Grouping still never crosses supplier, UOM, or currency.
create or replace function public.list_purchase_line_net_by_item(p_restaurant_id uuid)
returns table (
  supplier_id uuid,
  normalized_item_key text,
  unit_of_measure text,
  currency text,
  purchase_line_count bigint,
  credit_line_count bigint,
  net_quantity numeric,
  net_extended_price numeric,
  unmatched_credit boolean,
  first_transaction_date date,
  last_transaction_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_lines as (
    select
      line.supplier_id,
      private.resolve_purchase_line_item_key(
        line.restaurant_id,
        line.supplier_id,
        line.normalized_item_key
      ) as normalized_item_key,
      line.unit_of_measure,
      line.currency,
      line.line_type,
      line.signed_quantity,
      line.signed_extended_price,
      line.transaction_date
    from public.purchase_lines line
    where line.restaurant_id = p_restaurant_id
      and auth.uid() is not null
      and private.is_restaurant_member(p_restaurant_id)
      and not exists (
        select 1 from public.purchase_lines successor
        where successor.restaurant_id = line.restaurant_id
          and successor.supersedes_line_id = line.id
      )
  )
  select
    current_lines.supplier_id,
    current_lines.normalized_item_key,
    current_lines.unit_of_measure,
    current_lines.currency,
    pg_catalog.count(*) filter (where current_lines.line_type = 'purchase'),
    pg_catalog.count(*) filter (where current_lines.line_type = 'credit'),
    pg_catalog.sum(current_lines.signed_quantity),
    pg_catalog.sum(current_lines.signed_extended_price),
    pg_catalog.count(*) filter (where current_lines.line_type = 'purchase') = 0,
    pg_catalog.min(current_lines.transaction_date),
    pg_catalog.max(current_lines.transaction_date)
  from current_lines
  group by
    current_lines.supplier_id,
    current_lines.normalized_item_key,
    current_lines.unit_of_measure,
    current_lines.currency
  order by
    current_lines.normalized_item_key,
    current_lines.supplier_id,
    current_lines.unit_of_measure,
    current_lines.currency
$$;

comment on function public.list_purchase_line_net_by_item(uuid) is
  'Factual net quantity and spend per item from recorded lines. Manager-verified exact item-key aliases apply one hop. Credits whose resolved key matches no purchase are flagged unmatched, never netted silently.';
