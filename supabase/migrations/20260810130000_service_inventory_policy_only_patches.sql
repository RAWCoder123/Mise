-- Align service-owned inventory patches with Edge/client contracts:
-- on-hand quantity changes are append-only ledger events only.
-- private.service_update_inventory_and_signals may edit policy fields
-- (par, reorder, supplier) and refresh signals, but must not write
-- inventory_items.current_quantity directly.

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
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;
  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;
  if jsonb_typeof(safe_patch) <> 'object' or safe_patch = '{}'::jsonb
     or safe_patch - array['par_level', 'reorder_threshold', 'supplier_name'] <> '{}'::jsonb then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;
  select * into item_row from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  item_row.par_level := case when safe_patch ? 'par_level' then (safe_patch->>'par_level')::numeric else item_row.par_level end;
  item_row.reorder_threshold := case when safe_patch ? 'reorder_threshold' then (safe_patch->>'reorder_threshold')::numeric else item_row.reorder_threshold end;
  item_row.supplier_name := case when safe_patch ? 'supplier_name' then trim(safe_patch->>'supplier_name') else item_row.supplier_name end;
  if item_row.par_level not between 0 and 1000000
     or item_row.reorder_threshold not between 0 and 1000000
     or length(item_row.supplier_name) not between 1 and 160 then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;
  update public.inventory_items
  set par_level = item_row.par_level,
      reorder_threshold = item_row.reorder_threshold,
      supplier_name = item_row.supplier_name,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;
  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );
  return to_jsonb(item_row);
end;
$$;

revoke all on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_update_inventory_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_expected_revision,
    p_patch,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  to service_role;

comment on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) is
  'Service-owned inventory policy patch (par/reorder/supplier) with signal refresh. On-hand quantity changes must use record_inventory_event.';
