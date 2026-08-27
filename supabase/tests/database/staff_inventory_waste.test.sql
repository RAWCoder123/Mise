begin;

select plan(6);

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
    'f1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'f3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-staff-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('f0000000-0000-4000-8000-000000000001', 'Waste Kitchen A', 'Fast casual'),
  ('f0000000-0000-4000-8000-000000000002', 'Waste Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('f0000000-0000-4000-8000-000000000001', 'f2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('f0000000-0000-4000-8000-000000000002', 'f3333333-3333-4333-8333-333333333333', 'staff', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  ('f0000000-0000-4000-8000-000000000010', 'f0000000-0000-4000-8000-000000000001', 'Supplier A', 'supplier a'),
  ('f0000000-0000-4000-8000-000000000020', 'f0000000-0000-4000-8000-000000000002', 'Supplier B', 'supplier b');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000001',
  'Flour',
  'Dry',
  'lb',
  10,
  20,
  8,
  2,
  'f0000000-0000-4000-8000-000000000010',
  'Supplier A'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000011',
    'waste', 50, 'g', '2026-08-27T10:00:00Z', 'operator_waste',
    'staff-waste-1', 'staff-waste-1'
  )).id is not null,
  'staff can record a scoped waste event'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'count', 1000, 'g', now(), 'manual_count',
      'staff-count-denied-1', 'staff-count-denied-1'
    )
  $sql$),
  false,
  'staff cannot record count events'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'staff-receipt-denied-1', 'staff-receipt-denied-1'
    )
  $sql$),
  false,
  'staff cannot record receipt events'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'staff-stockout-denied-1', 'staff-stockout-denied-1'
    )
  $sql$),
  false,
  'staff cannot record stockout events'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000002',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 10, 'g', now(), 'operator_waste',
      'staff-cross-tenant-waste-1', 'staff-cross-tenant-waste-1'
    )
  $sql$),
  false,
  'staff cannot record waste for another restaurant'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f3333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 10, 'g', now(), 'operator_waste',
      'foreign-staff-waste-1', 'foreign-staff-waste-1'
    )
  $sql$),
  false,
  'staff from another restaurant cannot record waste'
);
reset role;

select * from finish();
rollback;
