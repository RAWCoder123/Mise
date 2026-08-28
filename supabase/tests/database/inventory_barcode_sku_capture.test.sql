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
    '51515151-5151-4151-8151-515151515151',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sku-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '61616161-6161-4161-8161-616161616161',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sku-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '71717171-7171-4171-8171-717171717171',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sku-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'SKU Kitchen A', 'Fast casual'),
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'SKU Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '51515151-5151-4151-8151-515151515151', 'manager', 'active'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', '61616161-6161-4161-8161-616161616161', 'staff', 'active'),
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', '71717171-7171-4171-8171-717171717171', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'Fresh Produce Co.', 'fresh produce co.'),
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'Cafe Supply', 'cafe supply');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values
  (
    'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    'Tomatoes', 'Produce', 'lb', 10, 20, 6, 2,
    'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'Fresh Produce Co.'
  ),
  (
    'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    'Lettuce', 'Produce', 'lb', 8, 16, 5, 1.5,
    'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 'Fresh Produce Co.'
  ),
  (
    'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
    'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
    'Coffee', 'Beverage', 'lb', 10, 20, 6, 4,
    'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4', 'Cafe Supply'
  );

select is(
  has_table_privilege('authenticated', 'public.supplier_items', 'UPDATE'),
  false,
  'authenticated clients cannot update supplier items directly'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.capture_inventory_item_supplier_sku(uuid,uuid,text)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can execute barcode SKU capture'
);

select is(
  has_function_privilege(
    'anon',
    'public.capture_inventory_item_supplier_sku(uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute barcode SKU capture'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51515151-5151-4151-8151-515151515151', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select supplier_sku
    from public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      ' 012345678905 '
    )
  ),
  '012345678905',
  'manager can capture a trimmed supplier SKU onto inventory'
);

select is(
  (
    select inventory_item_id
    from public.supplier_items
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and supplier_sku = '012345678905'
  ),
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'::uuid,
  'captured SKU rows bind the inventory item id'
);

select is(
  (
    select supplier_sku
    from public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      '012345678905'
    )
  ),
  '012345678905',
  'exact barcode capture replay is idempotent'
);

select is(
  pg_temp.try_execute($sql$
    select public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
      '012345678905'
    )
  $sql$),
  false,
  'same barcode cannot be captured onto a second inventory item'
);

select set_config('request.jwt.claim.sub', '61616161-6161-4161-8161-616161616161', true);

select is(
  pg_temp.try_execute($sql$
    select public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
      'LETTUCE-UPC-001'
    )
  $sql$),
  false,
  'staff cannot capture supplier SKU barcodes'
);

select set_config('request.jwt.claim.sub', '71717171-7171-4171-8171-717171717171', true);

select is(
  pg_temp.try_execute($sql$
    select public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
      'CROSS-TENANT-SKU'
    )
  $sql$),
  false,
  'cross-tenant barcode capture is denied'
);

select set_config('request.jwt.claim.sub', '51515151-5151-4151-8151-515151515151', true);

select is(
  (
    select count(*)::integer
    from public.audit_logs
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and action = 'inventory_barcode_sku_captured'
      and actor_user_id = '51515151-5151-4151-8151-515151515151'
  ),
  1,
  'barcode capture writes one audit row for the first change'
);

select is(
  pg_temp.try_execute($sql$
    select public.capture_inventory_item_supplier_sku(
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      E'bad\nsku'
    )
  $sql$),
  false,
  'control characters in barcode SKU are rejected'
);

select is(
  pg_temp.try_execute($sql$
    update public.supplier_items
    set supplier_sku = 'CLIENT-DML'
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
  $sql$),
  false,
  'direct client supplier_items updates remain blocked'
);

reset role;

select is(
  (
    select supplier_sku
    from public.supplier_items
    where restaurant_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and inventory_item_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
  ),
  '012345678905',
  'captured SKU remains durable after role reset'
);

select * from finish();
rollback;
