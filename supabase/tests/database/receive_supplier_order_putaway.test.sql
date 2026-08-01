begin;

select plan(24);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
as $$
begin
  execute statement;
  return true;
exception
  when others then
    return false;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'receive-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'receive-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'receive-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('c0000000-0000-4000-8000-000000000001', 'Receive Putaway Kitchen A', 'Fast casual'),
  ('c0000000-0000-4000-8000-000000000002', 'Receive Putaway Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'c3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  (
    'c0000000-0000-4000-8000-000000000011',
    'c0000000-0000-4000-8000-000000000001',
    'Romaine', 'Produce', 'case', 10, 4, 2, 8, 'Fresh Produce Co.'
  ),
  (
    'c0000000-0000-4000-8000-000000000012',
    'c0000000-0000-4000-8000-000000000001',
    'Olive Oil', 'Dry goods', 'bottle', 20, 8, 4, 12, 'Pantry Supply'
  );

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, operator_note, status, delivery_date
)
values
  (
    'c0000000-0000-4000-8000-000000000201',
    'c0000000-0000-4000-8000-000000000001',
    'Fresh Produce Co.', 'Receive walk-in put-away order', null, 'sent', current_date + 1
  ),
  (
    'c0000000-0000-4000-8000-000000000202',
    'c0000000-0000-4000-8000-000000000001',
    'Pantry Supply', 'Receive main put-away order', null, 'sent', current_date + 1
  );

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, supplier_order_id
)
values
  (
    'c0000000-0000-4000-8000-000000000101',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'Romaine', 'Fresh Produce Co.', 8, 'case', 'Receive put-away fixture', 'high', 'ordered',
    'c0000000-0000-4000-8000-000000000201'
  ),
  (
    'c0000000-0000-4000-8000-000000000102',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000012',
    'Olive Oil', 'Pantry Supply', 5, 'bottle', 'Receive main fixture', 'medium', 'ordered',
    'c0000000-0000-4000-8000-000000000202'
  );

-- Ensure Main + Walk-in stations exist for both restaurants.
set local role service_role;
select public.service_create_storage_location(
  'c1111111-1111-4111-8111-111111111111',
  'c0000000-0000-4000-8000-000000000001',
  'Walk-in'
);
select public.service_create_storage_location(
  'c3333333-3333-4333-8333-333333333333',
  'c0000000-0000-4000-8000-000000000002',
  'Walk-in'
);
reset role;

select is(
  has_function_privilege(
    'authenticated',
    'public.service_receive_supplier_order_and_signals(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the receive supplier-order service RPC'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_receive_supplier_order_and_signals(uuid,uuid,uuid,bigint,jsonb,jsonb,jsonb)',
    'EXECUTE'
  ),
  true,
  'service_role can execute the receive supplier-order service RPC'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_receive_supplier_order_and_signals(
    'c2222222-2222-4222-8222-222222222222',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000011',
        'quantity_received', 8,
        'storage_location_id', (
          select id::text
          from public.storage_locations
          where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
            and name = 'Walk-in'
          limit 1
        )
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$),
  false,
  'staff cannot receive a supplier order through the service RPC'
);
reset role;

select is(
  (select status from public.supplier_orders where id = 'c0000000-0000-4000-8000-000000000201'),
  'sent',
  'staff receive denial leaves the supplier order sent'
);
select is(
  (select current_quantity from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000011'),
  10::numeric,
  'staff receive denial leaves on-hand quantity unchanged'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_receive_supplier_order_and_signals(
    'c1111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000011',
        'quantity_received', 8,
        'storage_location_id', (
          select id::text
          from public.storage_locations
          where restaurant_id = 'c0000000-0000-4000-8000-000000000002'
            and name = 'Walk-in'
          limit 1
        )
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$),
  false,
  'receive rejects a cross-tenant storage location id'
);
reset role;

select is(
  (select status from public.supplier_orders where id = 'c0000000-0000-4000-8000-000000000201'),
  'sent',
  'cross-tenant storage denial leaves the supplier order sent'
);
select is(
  (select current_quantity from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000011'),
  10::numeric,
  'cross-tenant storage denial leaves on-hand quantity unchanged'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_receive_supplier_order_and_signals(
    'c1111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000011',
        'quantity_received', 8,
        'storage_location_id', 'deadbeef-dead-4deb-8eef-deadbeefdead'
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$),
  false,
  'receive rejects an unknown storage location id'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$select public.service_receive_supplier_order_and_signals(
    'c1111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000011',
        'quantity_received', 8,
        'note', 'Put away in walk-in',
        'storage_location_id', (
          select id::text
          from public.storage_locations
          where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
            and name = 'Walk-in'
          limit 1
        )
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$,
  'manager can receive a sent supplier order onto a Walk-in put-away station'
);
reset role;

select is(
  (select current_quantity from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000011'),
  18::numeric,
  'Walk-in put-away receive increases restaurant on-hand by the received quantity'
);

select is(
  (
    select balance.quantity
    from public.inventory_location_balances balance
    join public.storage_locations location
      on location.id = balance.storage_location_id
     and location.restaurant_id = balance.restaurant_id
    where balance.inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
      and location.name = 'Main'
  ),
  10::numeric,
  'Walk-in put-away returns Main station balance to the pre-receive on-hand amount'
);

select is(
  (
    select balance.quantity
    from public.inventory_location_balances balance
    join public.storage_locations location
      on location.id = balance.storage_location_id
     and location.restaurant_id = balance.restaurant_id
    where balance.inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
      and location.name = 'Walk-in'
  ),
  8::numeric,
  'Walk-in put-away lands the received quantity on the chosen station'
);

select is(
  (
    select coalesce(sum(balance.quantity), 0)
    from public.inventory_location_balances balance
    where balance.inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
  ),
  18::numeric,
  'Walk-in put-away keeps station balances equal to restaurant on-hand'
);

select is(
  (select status from public.supplier_orders where id = 'c0000000-0000-4000-8000-000000000201'),
  'completed',
  'successful receive marks the supplier order completed'
);

select is(
  (
    select reason
    from public.inventory_movements
    where inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
      and source_workflow = 'receive_supplier_order'
    order by created_at desc
    limit 1
  ),
  'receiving',
  'receive writes a receiving ledger movement'
);

select is(
  (
    select metadata->>'storage_location_name'
    from public.inventory_movements
    where inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
      and source_workflow = 'receive_supplier_order'
    order by created_at desc
    limit 1
  ),
  'Walk-in',
  'receive ledger metadata records the put-away station name'
);

select is(
  (
    select metadata->>'storage_location_id'
    from public.inventory_movements
    where inventory_item_id = 'c0000000-0000-4000-8000-000000000011'
      and source_workflow = 'receive_supplier_order'
    order by created_at desc
    limit 1
  ),
  (
    select id::text
    from public.storage_locations
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and name = 'Walk-in'
    limit 1
  ),
  'receive ledger metadata records the put-away station id'
);

set local role service_role;
select is(
  public.service_receive_supplier_order_and_signals(
    'c1111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000011',
        'quantity_received', 8,
        'storage_location_id', (
          select id::text
          from public.storage_locations
          where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
            and name = 'Walk-in'
          limit 1
        )
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )->>'outcome',
  'already_applied',
  're-receiving a completed order is idempotent'
);
reset role;

select is(
  (select current_quantity from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000011'),
  18::numeric,
  'idempotent re-receive does not double-count on-hand'
);

set local role service_role;
select lives_ok(
  $sql$select public.service_receive_supplier_order_and_signals(
    'c1111111-1111-4111-8111-111111111111',
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000202',
    (public.service_fetch_operational_planning_snapshot(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', 'c0000000-0000-4000-8000-000000000012',
        'quantity_received', 5
      )
    ),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$,
  'manager can receive onto Main when storage_location_id is omitted'
);
reset role;

select is(
  (select current_quantity from public.inventory_items where id = 'c0000000-0000-4000-8000-000000000012'),
  25::numeric,
  'Main-default receive increases restaurant on-hand by the received quantity'
);

select is(
  (
    select balance.quantity
    from public.inventory_location_balances balance
    join public.storage_locations location
      on location.id = balance.storage_location_id
     and location.restaurant_id = balance.restaurant_id
    where balance.inventory_item_id = 'c0000000-0000-4000-8000-000000000012'
      and location.name = 'Main'
  ),
  25::numeric,
  'Main-default receive keeps the full on-hand balance on Main'
);

select is(
  (
    select coalesce(balance.quantity, 0)
    from public.storage_locations location
    left join public.inventory_location_balances balance
      on balance.storage_location_id = location.id
     and balance.inventory_item_id = 'c0000000-0000-4000-8000-000000000012'
    where location.restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and location.name = 'Walk-in'
  ),
  0::numeric,
  'Main-default receive does not create Walk-in station stock'
);

select * from finish();
rollback;
