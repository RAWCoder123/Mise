begin;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'e1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'authoritative-pos@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('e0000000-0000-4000-8000-000000000001', 'Authoritative POS Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'e0000000-0000-4000-8000-000000000001',
  'e1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.pos_integrations (id, restaurant_id, provider, status)
values (
  'e0000000-0000-4000-8000-000000000101',
  'e0000000-0000-4000-8000-000000000001',
  'square',
  'connected'
);

insert into public.pos_locations (id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status)
values
  ('e0000000-0000-4000-8000-000000000201', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000101', 'loc-a', 'Location A', 'America/Los_Angeles', 'active'),
  ('e0000000-0000-4000-8000-000000000202', 'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000101', 'loc-b', 'Location B', 'America/Los_Angeles', 'active');

insert into public.menu_items (id, restaurant_id, name, category, active)
values
  ('e0000000-0000-4000-8000-000000000301', 'e0000000-0000-4000-8000-000000000001', 'Burger', 'Entree', true),
  ('e0000000-0000-4000-8000-000000000302', 'e0000000-0000-4000-8000-000000000001', 'Burger Deluxe', 'Entree', true),
  ('e0000000-0000-4000-8000-000000000303', 'e0000000-0000-4000-8000-000000000001', 'Fries', 'Side', true);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name, last_updated
)
values (
  'e0000000-0000-4000-8000-000000000999',
  'e0000000-0000-4000-8000-000000000001',
  'Bulk recommendation inventory',
  'Test',
  'each',
  0,
  0,
  0,
  1,
  'Supplier',
  '2026-08-10T00:00:00Z'
);

insert into public.pos_catalog_item_mappings (
  id, restaurant_id, pos_location_id, external_catalog_item_id, external_variation_id,
  external_name, menu_item_id, verification_status, confidence, effective_from
)
values
  (
    'e0000000-0000-4000-8000-000000000401',
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000201',
    'ITEM-A',
    'VAR-A',
    'Burger',
    'e0000000-0000-4000-8000-000000000301',
    'verified',
    1,
    '2026-08-10T00:00:00Z'
  ),
  (
    'e0000000-0000-4000-8000-000000000402',
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000202',
    'ITEM-A',
    'VAR-A',
    'Burger Deluxe',
    'e0000000-0000-4000-8000-000000000302',
    'verified',
    1,
    '2026-08-10T00:00:00Z'
  );

set local role service_role;

select lives_ok(
  $sql$
    select public.service_apply_square_sync_result(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000101',
      '[]'::jsonb,
      '[
        {"external_catalog_item_id":"ITEM-A","external_variation_id":"VAR-A","external_name":"Burger Renamed","category":"Square"},
        {"external_catalog_item_id":"ITEM-DRAFT","external_variation_id":"VAR-DRAFT","external_name":"Garlic Fries","category":"Square"}
      ]'::jsonb,
      null,
      '2026-08-10'::date,
      '2026-08-10'::date
    )
  $sql$,
  'square sync can process a rename and a new draft suggestion'
);

select is(
  (select menu_item_id from public.pos_catalog_item_mappings where id = 'e0000000-0000-4000-8000-000000000401'),
  'e0000000-0000-4000-8000-000000000301'::uuid,
  'verified mapping A keeps its authoritative menu item id after a provider rename'
);

select is(
  (select external_name from public.pos_catalog_item_mappings where id = 'e0000000-0000-4000-8000-000000000401'),
  'Burger Renamed',
  'verified mapping A may update display metadata without changing authority'
);

select is(
  (select menu_item_id from public.pos_catalog_item_mappings where id = 'e0000000-0000-4000-8000-000000000402'),
  'e0000000-0000-4000-8000-000000000302'::uuid,
  'same-name collision in location B keeps B authoritative'
);

select is(
  (select verification_status from public.pos_catalog_item_mappings where external_catalog_item_id = 'ITEM-DRAFT' and external_variation_id = 'VAR-DRAFT' and restaurant_id = 'e0000000-0000-4000-8000-000000000001' order by created_at desc, id desc limit 1),
  'draft',
  'automatic sync creates draft suggestions without verifying them'
);

select is(
  (select count(*) from public.pos_sales where restaurant_id = 'e0000000-0000-4000-8000-000000000001'),
  0::bigint,
  'no sales were inserted during mapping immutability checks'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos, source_record_id,
  provider_location_id, provider_catalog_item_id, provider_variation_id
)
select
  'e0000000-0000-4000-8000-000000000001',
  '2026-08-10'::date,
  'Burger',
  'Square',
  1,
  12,
  12,
  'Square',
  'bulk-' || gs::text,
  'loc-a',
  'ITEM-A',
  'VAR-A'
from generate_series(1, 2050) gs;

insert into public.purchase_recommendations (
  restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity, unit, reason, urgency, status, supplier_order_id, created_at
)
select
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000999',
  'Bulk recommendation ' || gs::text,
  'Supplier',
  1,
  'each',
  'Test',
  'low',
  'approved',
  null,
  '2026-08-10T00:00:00Z'::timestamptz + (gs || ' minutes')::interval
from generate_series(1, 520) gs;

select is(
  jsonb_array_length((public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ))->'sales'),
  2000,
  'planning snapshot keeps the 2000-sale bound'
);

select is(
  jsonb_array_length((public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ))->'recommendationHistory'),
  500,
  'planning snapshot keeps the bounded recommendation history'
);

select is(
  jsonb_array_length((public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ))->'providerMappings'),
  2,
  'planning snapshot includes verified provider mappings additively'
);

select is(
  (public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ))->'providerMappings'->0->>'providerLocationId',
  'loc-a',
  'provider mapping evidence carries provider location identity'
);

reset role;
select * from finish();
rollback;