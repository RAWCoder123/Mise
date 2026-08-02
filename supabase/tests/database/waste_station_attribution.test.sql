begin;

select plan(14);

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
    'd1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('d0000000-0000-4000-8000-000000000001', 'Waste Station Kitchen A', 'Fast casual'),
  ('d0000000-0000-4000-8000-000000000002', 'Waste Station Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('d0000000-0000-4000-8000-000000000001', 'd2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('d0000000-0000-4000-8000-000000000002', 'd3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  (
    'd0000000-0000-4000-8000-000000000011',
    'd0000000-0000-4000-8000-000000000001',
    'Romaine', 'Produce', 'case', 25, 8, 4, 8, 'Fresh Produce Co.'
  );

set local role service_role;
select public.service_create_storage_location(
  'd1111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001',
  'Walk-in'
);
select public.service_create_storage_location(
  'd3333333-3333-4333-8333-333333333333',
  'd0000000-0000-4000-8000-000000000002',
  'Walk-in'
);
reset role;

-- Seed station balances: Main 5 + Walk-in 20 = 25 on-hand.
insert into public.inventory_location_balances (
  restaurant_id, inventory_item_id, storage_location_id, quantity
)
select
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000011',
  id,
  case when name = 'Main' then 5 else 20 end
from public.storage_locations
where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
  and name in ('Main', 'Walk-in');

select is(
  has_function_privilege(
    'authenticated',
    'public.service_record_inventory_waste_and_signals(uuid,uuid,uuid,bigint,numeric,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the waste service RPC with station attribution'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_record_inventory_waste_and_signals(uuid,uuid,uuid,bigint,numeric,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  true,
  'service_role can execute the waste service RPC with station attribution'
);

set local role service_role;
select lives_ok(
  $sql$select public.service_record_inventory_waste_and_signals(
    'd2222222-2222-4222-8222-222222222222',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    (public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    8,
    'Outer leaves wilted',
    '[]'::jsonb,
    '[]'::jsonb,
    (
      select id
      from public.storage_locations
      where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
        and name = 'Walk-in'
      limit 1
    )
  )$sql$,
  'staff can record waste onto Walk-in through the service RPC'
);
reset role;

select is(
  (select current_quantity from public.inventory_items where id = 'd0000000-0000-4000-8000-000000000011'),
  17::numeric,
  'Walk-in waste deducts restaurant on-hand'
);

select is(
  (
    select quantity
    from public.inventory_location_balances balances
    join public.storage_locations locations
      on locations.id = balances.storage_location_id
    where balances.inventory_item_id = 'd0000000-0000-4000-8000-000000000011'
      and locations.name = 'Walk-in'
  ),
  12::numeric,
  'Walk-in waste reduces the chosen station balance'
);

select is(
  (
    select quantity
    from public.inventory_location_balances balances
    join public.storage_locations locations
      on locations.id = balances.storage_location_id
    where balances.inventory_item_id = 'd0000000-0000-4000-8000-000000000011'
      and locations.name = 'Main'
  ),
  5::numeric,
  'Walk-in waste leaves Main station balance unchanged'
);

select is(
  (
    select metadata->>'storage_location_name'
    from public.inventory_movements
    where inventory_item_id = 'd0000000-0000-4000-8000-000000000011'
      and reason = 'waste'
    order by created_at desc
    limit 1
  ),
  'Walk-in',
  'waste ledger metadata records the chosen station name'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_record_inventory_waste_and_signals(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    (public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    4,
    'Too much from Walk-in',
    '[]'::jsonb,
    '[]'::jsonb,
    (
      select id
      from public.storage_locations
      where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
        and name = 'Walk-in'
      limit 1
    )
  )$sql$),
  true,
  'manager can waste remaining Walk-in stock after prior attribution'
);
reset role;

select is(
  (
    select quantity
    from public.inventory_location_balances balances
    join public.storage_locations locations
      on locations.id = balances.storage_location_id
    where balances.inventory_item_id = 'd0000000-0000-4000-8000-000000000011'
      and locations.name = 'Walk-in'
  ),
  8::numeric,
  'second Walk-in waste continues reducing the chosen station'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_record_inventory_waste_and_signals(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    (public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    20,
    'Exceeds Walk-in',
    '[]'::jsonb,
    '[]'::jsonb,
    (
      select id
      from public.storage_locations
      where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
        and name = 'Walk-in'
      limit 1
    )
  )$sql$),
  false,
  'waste rejects quantity above the selected station balance'
);
reset role;

select is(
  (select current_quantity from public.inventory_items where id = 'd0000000-0000-4000-8000-000000000011'),
  13::numeric,
  'rejected oversize station waste leaves on-hand unchanged after prior accepted wastes'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_record_inventory_waste_and_signals(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    (public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    2,
    'Cross-tenant station',
    '[]'::jsonb,
    '[]'::jsonb,
    (
      select id
      from public.storage_locations
      where restaurant_id = 'd0000000-0000-4000-8000-000000000002'
        and name = 'Walk-in'
      limit 1
    )
  )$sql$),
  false,
  'waste rejects a cross-tenant storage location id'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$select public.service_record_inventory_waste_and_signals(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    (public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->>'revision')::bigint,
    2,
    'Default Main waste',
    '[]'::jsonb,
    '[]'::jsonb,
    null
  )$sql$,
  'manager can record waste onto Main when storage_location_id is omitted'
);
reset role;

select is(
  (
    select quantity
    from public.inventory_location_balances balances
    join public.storage_locations locations
      on locations.id = balances.storage_location_id
    where balances.inventory_item_id = 'd0000000-0000-4000-8000-000000000011'
      and locations.name = 'Main'
  ),
  3::numeric,
  'omitted storage location attributes waste to Main'
);

select * from finish();
rollback;
