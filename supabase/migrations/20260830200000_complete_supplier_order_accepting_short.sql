-- Managers can close a still-sent supplier order after prior delivery evidence
-- without writing another inventory receipt. Used when remaining quantity is
-- accepted as a short-ship (or already covered by received + missing lines).

create or replace function public.complete_supplier_order_accepting_short(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  prior_delivery_count integer := 0;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Supplier order id is required' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, order_row.supplier_id);

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select count(*)::integer into prior_delivery_count
  from public.supplier_deliveries delivery
  where delivery.restaurant_id = p_restaurant_id
    and delivery.supplier_order_id = p_order_id;

  if order_row.status = 'completed' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_completed',
      'orderId', order_row.id,
      'supplierId', order_row.supplier_id,
      'priorDeliveryCount', prior_delivery_count
    );
  end if;

  if order_row.status <> 'sent' then
    raise exception
      'Only sent supplier orders with prior delivery evidence can be closed as short-accepted'
      using errcode = '22023';
  end if;

  if prior_delivery_count < 1 then
    raise exception
      'Only sent supplier orders with prior delivery evidence can be closed as short-accepted'
      using errcode = '22023';
  end if;

  update public.supplier_orders orders
  set status = 'completed'
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id
    and orders.status = 'sent'
  returning * into order_row;

  perform private.append_activity_event(
    p_restaurant_id,
    'delivery_logged',
    'orders',
    'Supplier order closed after short',
    pg_catalog.format(
      '%s order closed after prior delivery evidence. Remaining short was accepted without another receipt.',
      order_row.supplier_name
    ),
    clock_timestamp(),
    'mise',
    'user',
    auth.uid(),
    'supplier_order_short_close',
    order_row.id::text,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'type', 'supplier_order',
        'id', order_row.id,
        'summary', order_row.supplier_name
      )
    ),
    array['mise', 'orders']::text[],
    null,
    null,
    5::smallint,
    null,
    'confirmed',
    false,
    null,
    'supplier_order',
    order_row.id::text,
    pg_catalog.format('supplier-order:%s', order_row.id),
    null,
    null,
    pg_catalog.format('supplier_order_short_close:%s', order_row.id),
    pg_catalog.jsonb_build_object(
      'priorDeliveryCount', prior_delivery_count,
      'outcome', 'short_accepted'
    ),
    null,
    null,
    null
  );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    auth.uid(),
    'supplier_order_short_accepted',
    'supplier_orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', order_row.supplier_id,
      'supplier_name', order_row.supplier_name,
      'prior_delivery_count', prior_delivery_count
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'orderId', order_row.id,
    'supplierId', order_row.supplier_id,
    'priorDeliveryCount', prior_delivery_count
  );
end;
$$;

revoke all on function public.complete_supplier_order_accepting_short(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_supplier_order_accepting_short(uuid, uuid)
  to authenticated;

comment on function public.complete_supplier_order_accepting_short(uuid, uuid) is
  'Manager-only close of a sent supplier order after prior delivery evidence, accepting any remaining short without another inventory receipt.';
