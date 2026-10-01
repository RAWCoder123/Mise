-- Apply a supplier confirmation's expected delivery onto a sent order's
-- delivery_date. Confirmations remain append-only evidence; this is an explicit
-- manager action that never invents dates from rejected/unverified rows.

create or replace function public.apply_supplier_confirmation_delivery_date(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_confirmation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  order_row public.supplier_orders;
  confirmation_row public.supplier_order_confirmations;
  restaurant_timezone text;
  proposed_delivery_date date;
  previous_delivery_date date;
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
    raise exception 'Supplier confirmation delivery updates are paused' using errcode = '55000';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_supplier_order_id
  for update;

  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  if order_row.status <> 'sent' then
    raise exception 'Only sent supplier orders can apply confirmation delivery dates'
      using errcode = '22023';
  end if;

  select * into confirmation_row
  from public.supplier_order_confirmations confirmations
  where confirmations.restaurant_id = p_restaurant_id
    and confirmations.id = p_confirmation_id
  for share;

  if not found then
    raise exception 'Supplier confirmation not found' using errcode = 'P0002';
  end if;

  if confirmation_row.supplier_order_id <> p_supplier_order_id then
    raise exception 'Supplier confirmation belongs to another order' using errcode = '22023';
  end if;

  if confirmation_row.confirmation_status not in ('acknowledged', 'changed') then
    raise exception 'Confirmation status cannot update delivery date' using errcode = '22023';
  end if;

  if confirmation_row.expected_delivery_at is null then
    raise exception 'Confirmation is missing an expected delivery time' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(restaurants.timezone), ''), 'UTC')
  into restaurant_timezone
  from public.restaurants restaurants
  where restaurants.id = p_restaurant_id;

  if restaurant_timezone is null then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  proposed_delivery_date :=
    (confirmation_row.expected_delivery_at at time zone restaurant_timezone)::date;
  previous_delivery_date := order_row.delivery_date;

  if previous_delivery_date is not distinct from proposed_delivery_date then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'supplierOrderId', order_row.id,
      'confirmationId', confirmation_row.id,
      'deliveryDate', proposed_delivery_date,
      'previousDeliveryDate', previous_delivery_date
    );
  end if;

  update public.supplier_orders
  set delivery_date = proposed_delivery_date
  where restaurant_id = p_restaurant_id
    and id = p_supplier_order_id;

  perform private.append_activity_event(
    p_restaurant_id,
    'delivery_expected',
    'orders',
    'Expected delivery updated',
    format(
      'Delivery date set to %s from supplier confirmation.',
      proposed_delivery_date::text
    ),
    now(),
    'manager_confirmation_apply',
    'user',
    actor_user_id,
    'supplier_confirmation_delivery_apply',
    confirmation_row.id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_confirmation', 'id', confirmation_row.id),
      jsonb_build_object('type', 'supplier_order', 'id', order_row.id)
    ),
    array['mise', 'orders']::text[],
    null,
    null,
    1::smallint,
    null,
    'confirmed',
    false,
    null,
    'supplier_order',
    order_row.id::text,
    format('supplier-order:%s', order_row.id),
    null,
    null,
    format(
      'supplier_confirmation_delivery_apply:%s:%s',
      confirmation_row.id,
      proposed_delivery_date::text
    ),
    jsonb_build_object(
      'confirmationId', confirmation_row.id,
      'supplierOrderId', order_row.id,
      'confirmationStatus', confirmation_row.confirmation_status,
      'previousDeliveryDate', previous_delivery_date,
      'deliveryDate', proposed_delivery_date,
      'expectedDeliveryAt', confirmation_row.expected_delivery_at
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
    'supplier_confirmation_delivery_applied',
    'supplier_orders',
    order_row.id,
    jsonb_build_object(
      'confirmationId', confirmation_row.id,
      'previousDeliveryDate', previous_delivery_date,
      'deliveryDate', proposed_delivery_date,
      'confirmationStatus', confirmation_row.confirmation_status
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'supplierOrderId', order_row.id,
    'confirmationId', confirmation_row.id,
    'deliveryDate', proposed_delivery_date,
    'previousDeliveryDate', previous_delivery_date
  );
end;
$$;

revoke all on function public.apply_supplier_confirmation_delivery_date(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.apply_supplier_confirmation_delivery_date(
  uuid, uuid, uuid
) to authenticated;

comment on function public.apply_supplier_confirmation_delivery_date(
  uuid, uuid, uuid
) is
  'Manager-only apply of an acknowledged/changed confirmation expected_delivery_at onto a sent supplier_orders.delivery_date in the restaurant timezone.';
