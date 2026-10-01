-- Managers can close a still-sent supplier order that never produced delivery
-- evidence, without writing an inventory receipt. Used when the supplier
-- cancelled, the truck never arrived, or the order was placed in error.
-- Complementary to complete_supplier_order_accepting_short (prior deliveries).

create or replace function public.complete_supplier_order_undelivered(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row public.supplier_orders%rowtype;
  prior_delivery_count integer := 0;
  normalized_reason text;
  reason_label text;
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Supplier order id is required' using errcode = '22023';
  end if;

  normalized_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if normalized_reason is null
    or normalized_reason not in ('supplier_cancelled', 'never_arrived', 'ordered_in_error')
  then
    raise exception 'A bounded undelivered-close reason is required' using errcode = '22023';
  end if;

  reason_label := case normalized_reason
    when 'supplier_cancelled' then 'Supplier cancelled'
    when 'never_arrived' then 'Delivery never arrived'
    else 'Ordered in error'
  end;

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
      'priorDeliveryCount', prior_delivery_count,
      'reason', normalized_reason
    );
  end if;

  if order_row.status <> 'sent' then
    raise exception
      'Only sent supplier orders without delivery evidence can be closed as undelivered'
      using errcode = '22023';
  end if;

  if prior_delivery_count > 0 then
    raise exception
      'Only sent supplier orders without delivery evidence can be closed as undelivered'
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
    'Supplier order closed undelivered',
    pg_catalog.format(
      '%s order closed without a delivery (%s). No inventory receipt was posted.',
      order_row.supplier_name,
      reason_label
    ),
    clock_timestamp(),
    'mise',
    'user',
    actor_user_id,
    'supplier_order_undelivered_close',
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
    pg_catalog.format('supplier_order_undelivered_close:%s', order_row.id),
    pg_catalog.jsonb_build_object(
      'priorDeliveryCount', prior_delivery_count,
      'outcome', 'undelivered_closed',
      'reason', normalized_reason
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
    'supplier_order_undelivered_closed',
    'supplier_orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', order_row.supplier_id,
      'supplier_name', order_row.supplier_name,
      'prior_delivery_count', prior_delivery_count,
      'reason', normalized_reason
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'orderId', order_row.id,
    'supplierId', order_row.supplier_id,
    'priorDeliveryCount', prior_delivery_count,
    'reason', normalized_reason
  );
end;
$$;

revoke all on function public.complete_supplier_order_undelivered(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_supplier_order_undelivered(uuid, uuid, text)
  to authenticated;

comment on function public.complete_supplier_order_undelivered(uuid, uuid, text) is
  'Manager-only close of a sent supplier order with zero delivery evidence, requiring a bounded reason and writing no inventory receipt.';
