-- Durable structured supplier order lines.
-- Dual-writes line snapshots from linked purchase_recommendations on approve,
-- undo, and Gmail send completion. order_message remains the send/copy projection.
-- Authenticated clients receive SELECT only; mutations stay inside SECURITY DEFINER RPCs.

create table if not exists public.supplier_order_lines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_order_id uuid not null,
  inventory_item_id uuid not null,
  purchase_recommendation_id uuid,
  item_name text not null
    check (char_length(btrim(item_name)) between 1 and 160),
  ordered_quantity numeric not null
    check (ordered_quantity > 0 and ordered_quantity <= 1000000),
  unit text not null
    check (char_length(btrim(unit)) between 1 and 40),
  canonical_unit text
    check (
      canonical_unit is null
      or canonical_unit in ('g', 'ml', 'each')
    ),
  estimated_unit_cost numeric
    check (
      estimated_unit_cost is null
      or (estimated_unit_cost >= 0 and estimated_unit_cost <= 1000000)
    ),
  line_position integer not null default 0
    check (line_position >= 0 and line_position <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, supplier_order_id, inventory_item_id),
  unique (restaurant_id, purchase_recommendation_id),
  constraint supplier_order_lines_order_tenant_fkey
    foreign key (restaurant_id, supplier_order_id)
    references public.supplier_orders (restaurant_id, id)
    on delete cascade,
  constraint supplier_order_lines_inventory_tenant_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id)
    on delete restrict,
  constraint supplier_order_lines_recommendation_tenant_fkey
    foreign key (restaurant_id, purchase_recommendation_id)
    references public.purchase_recommendations (restaurant_id, id)
    on delete set null
);

create index supplier_order_lines_order_idx
  on public.supplier_order_lines (restaurant_id, supplier_order_id, line_position, id);

comment on table public.supplier_order_lines is
  'Durable structured supplier-order lines. Snapshots approve/send quantities; never a client-writable authority surface. Totals stay non-authoritative until every line has verified cost.';

alter table public.supplier_order_lines enable row level security;

drop policy if exists "Members can read supplier order lines" on public.supplier_order_lines;
create policy "Members can read supplier order lines"
on public.supplier_order_lines for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.supplier_order_lines from public, anon, authenticated;
revoke all on table public.supplier_order_lines from service_role;
grant select on public.supplier_order_lines to authenticated;
grant select, insert, update, delete on table public.supplier_order_lines to service_role;

create or replace function private.sync_supplier_order_lines(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  line_count integer := 0;
begin
  if p_restaurant_id is null or p_order_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id
  ) then
    return 0;
  end if;

  delete from public.supplier_order_lines line
  where line.restaurant_id = p_restaurant_id
    and line.supplier_order_id = p_order_id
    and not exists (
      select 1
      from public.purchase_recommendations recommendation
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.supplier_order_id = p_order_id
        and recommendation.status in ('approved', 'ordered')
        and recommendation.inventory_item_id = line.inventory_item_id
        and (
          line.purchase_recommendation_id is null
          or recommendation.id = line.purchase_recommendation_id
        )
    );

  with ranked as (
    select
      recommendation.id as purchase_recommendation_id,
      recommendation.inventory_item_id,
      recommendation.item_name,
      recommendation.recommended_quantity as ordered_quantity,
      recommendation.unit,
      inventory.canonical_unit,
      inventory.estimated_unit_cost,
      (
        row_number() over (
          order by recommendation.item_name, recommendation.id
        ) - 1
      )::integer as line_position
    from public.purchase_recommendations recommendation
    join public.inventory_items inventory
      on inventory.restaurant_id = recommendation.restaurant_id
     and inventory.id = recommendation.inventory_item_id
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status in ('approved', 'ordered')
  )
  insert into public.supplier_order_lines (
    restaurant_id,
    supplier_order_id,
    inventory_item_id,
    purchase_recommendation_id,
    item_name,
    ordered_quantity,
    unit,
    canonical_unit,
    estimated_unit_cost,
    line_position,
    updated_at
  )
  select
    p_restaurant_id,
    p_order_id,
    ranked.inventory_item_id,
    ranked.purchase_recommendation_id,
    ranked.item_name,
    ranked.ordered_quantity,
    ranked.unit,
    case
      when ranked.canonical_unit in ('g', 'ml', 'each') then ranked.canonical_unit
      else null
    end,
    ranked.estimated_unit_cost,
    ranked.line_position,
    pg_catalog.now()
  from ranked
  on conflict (restaurant_id, supplier_order_id, inventory_item_id)
  do update set
    purchase_recommendation_id = excluded.purchase_recommendation_id,
    item_name = excluded.item_name,
    ordered_quantity = excluded.ordered_quantity,
    unit = excluded.unit,
    canonical_unit = excluded.canonical_unit,
    estimated_unit_cost = excluded.estimated_unit_cost,
    line_position = excluded.line_position,
    updated_at = pg_catalog.now();

  get diagnostics line_count = row_count;
  return line_count;
end;
$$;

revoke all on function private.sync_supplier_order_lines(uuid, uuid)
from public, anon, authenticated, service_role;

-- Backfill existing drafts and sent/completed orders from linked recommendations.
do $$
declare
  order_row record;
begin
  for order_row in
    select orders.restaurant_id, orders.id
    from public.supplier_orders orders
    where exists (
      select 1
      from public.purchase_recommendations recommendation
      where recommendation.restaurant_id = orders.restaurant_id
        and recommendation.supplier_order_id = orders.id
        and recommendation.status in ('approved', 'ordered')
    )
  loop
    perform private.sync_supplier_order_lines(order_row.restaurant_id, order_row.id);
  end loop;
end $$;

-- Wrap approve so applied/already_applied drafts always refresh durable lines.
alter function public.approve_purchase_recommendation(uuid, uuid, numeric)
  rename to approve_purchase_recommendation_pre_order_lines;
alter function public.approve_purchase_recommendation_pre_order_lines(uuid, uuid, numeric)
  set schema private;

revoke all on function private.approve_purchase_recommendation_pre_order_lines(uuid, uuid, numeric)
from public, anon, authenticated, service_role;

create function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  result := private.approve_purchase_recommendation_pre_order_lines(
    p_restaurant_id, p_recommendation_id, p_recommended_quantity
  );
  order_id := nullif(result#>>'{order,id}', '')::uuid;
  if order_id is not null then
    perform private.sync_supplier_order_lines(p_restaurant_id, order_id);
  end if;
  return result;
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
to authenticated;

-- Wrap undo so remaining drafts refresh; deleted drafts cascade-remove lines.
alter function public.undo_purchase_recommendation_action(uuid, uuid)
  rename to undo_purchase_recommendation_action_pre_order_lines;
alter function public.undo_purchase_recommendation_action_pre_order_lines(uuid, uuid)
  set schema private;

revoke all on function private.undo_purchase_recommendation_action_pre_order_lines(uuid, uuid)
from public, anon, authenticated, service_role;

create function public.undo_purchase_recommendation_action(
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  result := private.undo_purchase_recommendation_action_pre_order_lines(
    p_restaurant_id, p_recommendation_id
  );
  order_id := nullif(result#>>'{order,id}', '')::uuid;
  if order_id is not null then
    perform private.sync_supplier_order_lines(p_restaurant_id, order_id);
  end if;
  return result;
end;
$$;

revoke all on function public.undo_purchase_recommendation_action(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.undo_purchase_recommendation_action(uuid, uuid)
to authenticated;

-- After Gmail send completion, refresh lines from ordered recommendations.
alter function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)
  rename to service_complete_supplier_email_send_pre_order_lines;

revoke all on function private.service_complete_supplier_email_send_pre_order_lines(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

create function private.service_complete_supplier_email_send(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_actor_user_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  result := private.service_complete_supplier_email_send_pre_order_lines(
    p_restaurant_id,
    p_order_id,
    p_actor_user_id,
    p_claim_token,
    p_provider_message_id
  );
  perform private.sync_supplier_order_lines(p_restaurant_id, p_order_id);
  return result;
end;
$$;

revoke all on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_complete_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) to service_role;
