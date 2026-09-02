-- Apply a received delivery line's invoice unit_price onto inventory
-- estimated_unit_cost. Delivery evidence stays append-only; this is an explicit
-- manager action that never invents prices.

create or replace function public.apply_invoice_unit_cost_from_delivery(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_delivery_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  item_row public.inventory_items%rowtype;
  delivery_item_row public.supplier_delivery_items%rowtype;
  delivery_row public.supplier_deliveries%rowtype;
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
    raise exception 'Invoice unit-cost updates are paused' using errcode = '55000';
  end if;

  select * into item_row
  from public.inventory_items items
  where items.restaurant_id = p_restaurant_id
    and items.id = p_inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;

  select * into delivery_item_row
  from public.supplier_delivery_items delivery_items
  where delivery_items.restaurant_id = p_restaurant_id
    and delivery_items.id = p_delivery_item_id
  for share;

  if not found then
    raise exception 'Supplier delivery line not found' using errcode = 'P0002';
  end if;

  if delivery_item_row.inventory_item_id <> p_inventory_item_id then
    raise exception 'Delivery line belongs to another inventory item' using errcode = '22023';
  end if;

  if delivery_item_row.received_quantity is null
    or delivery_item_row.received_quantity <= 0
  then
    raise exception 'Delivery line has no received quantity' using errcode = '22023';
  end if;

  if delivery_item_row.unit_price is null then
    raise exception 'Delivery line is missing an invoice unit price' using errcode = '22023';
  end if;

  if delivery_item_row.unit_price < 0
    or delivery_item_row.unit_price > 1000000
  then
    raise exception 'Delivery unit price is outside supported limits' using errcode = '22023';
  end if;

  select * into delivery_row
  from public.supplier_deliveries deliveries
  where deliveries.restaurant_id = p_restaurant_id
    and deliveries.id = delivery_item_row.delivery_id
  for share;

  if not found then
    raise exception 'Supplier delivery not found' using errcode = 'P0002';
  end if;

  previous_unit_cost := round(coalesce(item_row.estimated_unit_cost, 0)::numeric, 4);
  proposed_unit_cost := round(delivery_item_row.unit_price::numeric, 4);

  if previous_unit_cost is not distinct from proposed_unit_cost then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'inventoryItemId', item_row.id,
      'deliveryItemId', delivery_item_row.id,
      'deliveryId', delivery_row.id,
      'unitPrice', proposed_unit_cost,
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
    'Unit cost updated from invoice',
    format(
      'Estimated unit cost set to %s from a received delivery invoice price.',
      proposed_unit_cost::text
    ),
    now(),
    'manager_invoice_unit_cost_apply',
    'user',
    actor_user_id,
    'invoice_unit_cost_apply',
    delivery_item_row.id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_delivery_item', 'id', delivery_item_row.id),
      jsonb_build_object('type', 'supplier_delivery', 'id', delivery_row.id),
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
      'invoice_unit_cost_apply:%s:%s',
      delivery_item_row.id,
      proposed_unit_cost::text
    ),
    jsonb_build_object(
      'deliveryItemId', delivery_item_row.id,
      'deliveryId', delivery_row.id,
      'inventoryItemId', item_row.id,
      'previousUnitCost', previous_unit_cost,
      'unitPrice', proposed_unit_cost,
      'receivedAt', delivery_row.received_at
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
    'invoice_unit_cost_applied',
    'inventory_items',
    item_row.id,
    jsonb_build_object(
      'deliveryItemId', delivery_item_row.id,
      'deliveryId', delivery_row.id,
      'previousUnitCost', previous_unit_cost,
      'unitPrice', proposed_unit_cost
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'inventoryItemId', item_row.id,
    'deliveryItemId', delivery_item_row.id,
    'deliveryId', delivery_row.id,
    'unitPrice', proposed_unit_cost,
    'previousUnitCost', previous_unit_cost
  );
end;
$$;

revoke all on function public.apply_invoice_unit_cost_from_delivery(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.apply_invoice_unit_cost_from_delivery(
  uuid, uuid, uuid
) to authenticated;

comment on function public.apply_invoice_unit_cost_from_delivery(
  uuid, uuid, uuid
) is
  'Manager-only apply of a supplier_delivery_items.unit_price onto inventory_items.estimated_unit_cost for the same tenant item.';
