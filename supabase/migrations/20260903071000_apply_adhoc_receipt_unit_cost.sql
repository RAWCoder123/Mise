-- Apply an operator-entered ad-hoc Log Delivery / inventory-detail receipt
-- unit cost onto inventory estimated_unit_cost. Distinct from supplier-order
-- invoice apply: no delivery line evidence is required. Never invents a price.

create or replace function public.apply_adhoc_receipt_unit_cost(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_unit_cost numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  item_row public.inventory_items%rowtype;
  previous_unit_cost numeric;
  proposed_unit_cost numeric;
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.system_operational_controls controls
    where controls.singleton
      and controls.operational_mode <> 'normal'
  ) then
    raise exception 'Ad-hoc receipt unit-cost updates are paused' using errcode = '55000';
  end if;

  if p_unit_cost is null
    or p_unit_cost < 0
    or p_unit_cost > 1000000
  then
    raise exception 'Unit cost is outside supported limits' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items items
  where items.restaurant_id = p_restaurant_id
    and items.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;

  previous_unit_cost := round(coalesce(item_row.estimated_unit_cost, 0)::numeric, 4);
  proposed_unit_cost := round(p_unit_cost::numeric, 4);

  if previous_unit_cost is not distinct from proposed_unit_cost then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'inventoryItemId', item_row.id,
      'unitCost', proposed_unit_cost,
      'previousUnitCost', previous_unit_cost
    );
  end if;

  update public.inventory_items
  set estimated_unit_cost = proposed_unit_cost,
      last_updated = pg_catalog.clock_timestamp()
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id;

  perform private.append_activity_event(
    p_restaurant_id,
    'supplier_prices_checked',
    'inventory',
    'Unit cost updated from receipt',
    format(
      'Estimated unit cost set to %s from an ad-hoc delivery receipt.',
      proposed_unit_cost::text
    ),
    now(),
    'manager_adhoc_receipt_unit_cost_apply',
    'user',
    actor_user_id,
    'adhoc_receipt_unit_cost_apply',
    item_row.id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'inventory_item', 'id', item_row.id)
    ),
    array['mise', 'inventory']::text[],
    null,
    null,
    1::smallint,
    null,
    'completed',
    false,
    null,
    'inventory_item',
    item_row.id::text,
    format('inventory-item:%s', item_row.id),
    null,
    null,
    format(
      'adhoc_receipt_unit_cost_apply:%s:%s',
      item_row.id,
      proposed_unit_cost::text
    ),
    jsonb_build_object(
      'inventoryItemId', item_row.id,
      'previousUnitCost', previous_unit_cost,
      'unitCost', proposed_unit_cost
    ),
    null,
    null,
    null
  );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'adhoc_receipt_unit_cost_applied',
    'inventory_items',
    item_row.id,
    jsonb_build_object(
      'previousUnitCost', previous_unit_cost,
      'unitCost', proposed_unit_cost
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'inventoryItemId', item_row.id,
    'unitCost', proposed_unit_cost,
    'previousUnitCost', previous_unit_cost
  );
end;
$$;

revoke all on function public.apply_adhoc_receipt_unit_cost(
  uuid, uuid, numeric
) from public, anon, authenticated, service_role;
grant execute on function public.apply_adhoc_receipt_unit_cost(
  uuid, uuid, numeric
) to authenticated;

comment on function public.apply_adhoc_receipt_unit_cost(
  uuid, uuid, numeric
) is
  'Manager-only apply of an operator-entered ad-hoc receipt unit cost onto inventory_items.estimated_unit_cost for the same tenant item.';
