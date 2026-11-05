-- Inventory purchasing policy: safety stock buffer quantity.
-- Additive column defaults to 0 so existing reorder-threshold behavior is
-- unchanged until a manager sets a value. Patches remain service-owned policy
-- fields only; on-hand quantity still changes only through the inventory
-- event ledger. When configured, safety stock raises the effective reorder
-- trigger to max(reorder_threshold, safety_stock) without inventing orders
-- on its own or changing purchase/send authority.

alter table public.inventory_items
  add column if not exists safety_stock numeric not null default 0;

do $$
begin
  alter table public.inventory_items
    drop constraint if exists inventory_items_safety_stock_check;
  alter table public.inventory_items
    add constraint inventory_items_safety_stock_check
    check (safety_stock between 0 and 1000000);
end;
$$;

comment on column public.inventory_items.safety_stock is
  'Minimum on-hand buffer in inventory units. 0 means unused; when positive, the effective reorder trigger is max(reorder_threshold, safety_stock). Suggested order quantities still restore to par.';

create or replace function private.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  safe_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  item_row public.inventory_items%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select state.planning_revision into current_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot'
      using errcode = '40001';
  end if;
  if pg_catalog.jsonb_typeof(safe_patch) <> 'object'
    or safe_patch = '{}'::jsonb
    or safe_patch - array[
      'par_level',
      'reorder_threshold',
      'safety_stock'
    ] <> '{}'::jsonb
  then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;
  select * into item_row from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  for update;
  if not found then raise exception 'Inventory item not found' using errcode = 'P0002'; end if;
  item_row.par_level := case when safe_patch ? 'par_level'
    then (safe_patch->>'par_level')::numeric else item_row.par_level end;
  item_row.reorder_threshold := case when safe_patch ? 'reorder_threshold'
    then (safe_patch->>'reorder_threshold')::numeric else item_row.reorder_threshold end;
  item_row.safety_stock := case when safe_patch ? 'safety_stock'
    then (safe_patch->>'safety_stock')::numeric else item_row.safety_stock end;
  if item_row.par_level not between 0 and 1000000
    or item_row.reorder_threshold not between 0 and 1000000
    or item_row.safety_stock not between 0 and 1000000
  then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;
  update public.inventory_items item
  set par_level = item_row.par_level,
    reorder_threshold = item_row.reorder_threshold,
    safety_stock = item_row.safety_stock,
    last_updated = pg_catalog.clock_timestamp()
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  returning * into item_row;
  select state.planning_revision into commit_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision,
    p_recommendations, p_insights, false, '{}'::jsonb
  );
  return pg_catalog.to_jsonb(item_row);
end;
$$;

revoke all on function private.service_update_inventory_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function private.service_update_inventory_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

comment on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) is
  'Service-owned inventory policy patch (par/reorder/safety stock) with signal refresh. On-hand quantity changes must use record_inventory_event.';
