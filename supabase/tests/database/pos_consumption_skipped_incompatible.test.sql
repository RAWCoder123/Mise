begin;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'd1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pos-consume-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pos-consume-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pos-consume-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('d0000000-0000-4000-8000-000000000001', 'POS Consume Kitchen A', 'Fast casual'),
  ('d0000000-0000-4000-8000-000000000002', 'POS Consume Kitchen B', 'Cafe');

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
    'Chicken thigh', 'Protein', 'lb', 80, 40, 20, 3.5, 'Protein Co'
  ),
  (
    'd0000000-0000-4000-8000-000000000012',
    'd0000000-0000-4000-8000-000000000001',
    'Rice', 'Dry goods', 'lb', 50, 20, 10, 1.2, 'Pantry Co'
  );

insert into public.menu_item_ingredients (
  id, restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
)
values
  (
    'd0000000-0000-4000-8000-000000000101',
    'd0000000-0000-4000-8000-000000000001',
    'General Tso Chicken',
    'd0000000-0000-4000-8000-000000000011',
    0.42,
    'lb'
  ),
  (
    'd0000000-0000-4000-8000-000000000102',
    'd0000000-0000-4000-8000-000000000001',
    'General Tso Chicken',
    'd0000000-0000-4000-8000-000000000012',
    0.24,
    'kg'
  ),
  (
    'd0000000-0000-4000-8000-000000000103',
    'd0000000-0000-4000-8000-000000000001',
    'Broken Bowl',
    'd0000000-0000-4000-8000-000000000011',
    0.5,
    'kg'
  );

select ok(
  has_function_privilege(
    'service_role',
    'public.service_ingest_manual_pos_sales(uuid,uuid,jsonb,text)',
    'execute'
  ),
  'service_role can execute manual POS CSV ingest'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.service_ingest_manual_pos_sales(uuid,uuid,jsonb,text)',
    'execute'
  ),
  'authenticated cannot execute manual POS CSV ingest directly'
);

create temporary table pg_temp.pos_ingest_summary (
  payload jsonb not null
) on commit drop;

set local role service_role;

insert into pg_temp.pos_ingest_summary (payload)
select public.service_ingest_manual_pos_sales(
  'd1111111-1111-4111-8111-111111111111',
  'd0000000-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object(
      'source_record_id', 'csv_mixed_1',
      'sale_date', current_date,
      'item_name', 'General Tso Chicken',
      'category', 'Entrees',
      'quantity_sold', 10,
      'gross_sales', 150,
      'net_sales', 140,
      'source_pos', 'Manual CSV Upload'
    ),
    jsonb_build_object(
      'source_record_id', 'csv_unmapped_1',
      'sale_date', current_date,
      'item_name', 'Mystery Special',
      'category', 'Entrees',
      'quantity_sold', 2,
      'gross_sales', 30,
      'net_sales', 28,
      'source_pos', 'Manual CSV Upload'
    ),
    jsonb_build_object(
      'source_record_id', 'csv_incompatible_only_1',
      'sale_date', current_date,
      'item_name', 'Broken Bowl',
      'category', 'Entrees',
      'quantity_sold', 3,
      'gross_sales', 45,
      'net_sales', 42,
      'source_pos', 'Manual CSV Upload'
    )
  ),
  'mixed-units.csv'
);

reset role;

select is(
  (select (payload->>'skipped_incompatible_count')::integer from pg_temp.pos_ingest_summary),
  2,
  'ingest reports two unit-incompatible mapping skips'
);

select is(
  (select (payload->>'unmapped_sale_count')::integer from pg_temp.pos_ingest_summary),
  2,
  'unmapped count covers mystery sale plus fully incompatible Broken Bowl'
);

select is(
  (select (payload->>'consumption_movements_written')::integer from pg_temp.pos_ingest_summary),
  1,
  'only the compatible General Tso chicken mapping writes a consumption movement'
);

set local role service_role;

select is(
  (
    public.service_ingest_manual_pos_sales(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'source_record_id', 'csv_mixed_1',
          'sale_date', current_date,
          'item_name', 'General Tso Chicken',
          'category', 'Entrees',
          'quantity_sold', 10,
          'gross_sales', 150,
          'net_sales', 140,
          'source_pos', 'Manual CSV Upload'
        )
      ),
      'idempotent-compatible.csv'
    )->>'consumption_movements_written'
  )::integer,
  0,
  'identical re-ingest remains idempotent and writes no new movements'
);

reset role;

select is(
  (
    select round(current_quantity::numeric, 4)
    from public.inventory_items
    where id = 'd0000000-0000-4000-8000-000000000011'
  ),
  75.8000,
  'compatible chicken mapping still deducts inventory (80 - 4.2)'
);

select is(
  (
    select round(current_quantity::numeric, 4)
    from public.inventory_items
    where id = 'd0000000-0000-4000-8000-000000000012'
  ),
  50.0000,
  'incompatible rice kg mapping does not deduct rice inventory'
);

set local role service_role;

select throws_ok(
  $$
    select public.service_ingest_manual_pos_sales(
      'd2222222-2222-4222-8222-222222222222',
      'd0000000-0000-4000-8000-000000000001',
      jsonb_build_array(
        jsonb_build_object(
          'source_record_id', 'csv_staff_denied',
          'sale_date', current_date,
          'item_name', 'General Tso Chicken',
          'category', 'Entrees',
          'quantity_sold', 1,
          'gross_sales', 15,
          'net_sales', 14,
          'source_pos', 'Manual CSV Upload'
        )
      ),
      'staff.csv'
    )
  $$,
  '42501',
  'Not authorized for this restaurant',
  'staff cannot ingest POS CSV for their restaurant'
);

reset role;
set local role service_role;

select throws_ok(
  $$
    select public.service_ingest_manual_pos_sales(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000002',
      jsonb_build_array(
        jsonb_build_object(
          'source_record_id', 'csv_cross_tenant',
          'sale_date', current_date,
          'item_name', 'General Tso Chicken',
          'category', 'Entrees',
          'quantity_sold', 1,
          'gross_sales', 15,
          'net_sales', 14,
          'source_pos', 'Manual CSV Upload'
        )
      ),
      'cross-tenant.csv'
    )
  $$,
  '42501',
  'Not authorized for this restaurant',
  'manager cannot ingest POS CSV into another restaurant'
);

select * from finish();
rollback;
