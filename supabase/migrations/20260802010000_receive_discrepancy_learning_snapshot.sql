-- Include receiving ledger samples in the operational planning snapshot so
-- Edge signal refresh can learn bounded short-ship fill-rate bias and emit
-- chronic short-ship ordering insights without new business tables.

create index if not exists inventory_movements_restaurant_receiving_created_at_idx
  on public.inventory_movements (restaurant_id, created_at desc)
  where reason = 'receiving';

create or replace function private.fetch_operational_planning_snapshot(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  operating_date date;
begin
  -- Service-role only. Staff need snapshots for waste signal refresh; Edge still
  -- gates which mutations staff may perform.
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending')
  on conflict (restaurant_id) do nothing;
  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := current_date;
  end;

  return jsonb_build_object(
    'revision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
    'inventoryItems', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.item_name, item.id)
      from public.inventory_items item where item.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.sale_date desc, sale.item_name, sale.id)
      from (
        select * from public.pos_sales
        where restaurant_id = p_restaurant_id
        order by sale_date desc, id
        limit 2000
      ) sale
    ), '[]'::jsonb),
    'menuItemIngredients', coalesce((
      select jsonb_agg(to_jsonb(mapping) order by mapping.menu_item_name, mapping.id)
      from public.menu_item_ingredients mapping where mapping.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'recommendationHistory', coalesce((
      select jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at desc, recommendation.id)
      from (
        select * from public.purchase_recommendations
        where restaurant_id = p_restaurant_id and status <> 'pending'
        order by created_at desc, id
        limit 500
      ) recommendation
    ), '[]'::jsonb),
    'appliedTodayConsumptionByItemId', coalesce((
      select jsonb_object_agg(inventory_item_id::text, consumed)
      from (
        select
          movement.inventory_item_id,
          round(sum(greatest(0, movement.quantity_before - movement.quantity_after)), 4) as consumed
        from public.inventory_movements movement
        where movement.restaurant_id = p_restaurant_id
          and movement.reason in ('recipe_consumption', 'pos_consumption')
          and (movement.metadata->>'sale_date')::date = coalesce(operating_date, current_date)
        group by movement.inventory_item_id
      ) applied
    ), '{}'::jsonb),
    'receivingHistory', coalesce((
      select jsonb_agg(sample order by sample->>'createdAt' desc)
      from (
        select jsonb_build_object(
          'inventoryItemId', movement.inventory_item_id,
          'quantityOrdered', (movement.metadata->>'quantity_ordered')::numeric,
          'quantityReceived', (movement.metadata->>'quantity_received')::numeric,
          'discrepancy', coalesce(
            (movement.metadata->>'discrepancy')::numeric,
            (movement.metadata->>'quantity_received')::numeric
              - (movement.metadata->>'quantity_ordered')::numeric
          ),
          'createdAt', movement.created_at,
          'supplierOrderId', nullif(movement.metadata->>'supplier_order_id', '')
        ) as sample
        from public.inventory_movements movement
        where movement.restaurant_id = p_restaurant_id
          and movement.reason = 'receiving'
          and movement.metadata ? 'quantity_ordered'
          and movement.metadata ? 'quantity_received'
          and (movement.metadata->>'quantity_ordered') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          and (movement.metadata->>'quantity_received') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          and (movement.metadata->>'quantity_ordered')::numeric > 0
          and (movement.metadata->>'quantity_received')::numeric >= 0
        order by movement.created_at desc, movement.id
        limit 500
      ) receiving
    ), '[]'::jsonb)
  );
end;
$$;

comment on function private.fetch_operational_planning_snapshot(uuid, uuid) is
  'Service-owned planning snapshot for owner/admin/manager/staff, including receivingHistory for short-ship learning. Edge enforces which mutations staff may run.';
