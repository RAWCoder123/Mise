begin;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'd1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'square-manager@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('d0000000-0000-4000-8000-000000000001', 'Square Replay Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'd0000000-0000-4000-8000-000000000001',
  'd1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.pos_integrations (
  id, restaurant_id, provider, status
)
values (
  'd0000000-0000-4000-8000-000000000101',
  'd0000000-0000-4000-8000-000000000001',
  'square',
  'connected'
);

set local role service_role;

select is(
  (
    public.service_apply_square_sync_result(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000101',
      '[
        {"source_record_id":"square-order-1-line-1","sale_date":"2026-08-10","item_name":"Burger","category":"Square","quantity_sold":2,"gross_sales":24,"net_sales":24,"provider_catalog_item_id":"ITEM-A","provider_variation_id":"VAR-A"},
        {"source_record_id":"square-order-1-line-2","sale_date":"2026-08-10","item_name":"Fries","category":"Square","quantity_sold":1,"gross_sales":6,"net_sales":6}
      ]'::jsonb,
      '[]'::jsonb,
      null,
      '2026-08-10'::date,
      '2026-08-10'::date
    )->>'recordsProcessed'
  )::integer,
  2,
  'first Square sync reports the two normalized rows it processed'
);

select is(
  (select count(*) from public.pos_sales where restaurant_id = 'd0000000-0000-4000-8000-000000000001'),
  2::bigint,
  'first Square sync persists two logical sales rows'
);

select is(
  (select provider_catalog_item_id || ':' || provider_variation_id from public.pos_sales where restaurant_id = 'd0000000-0000-4000-8000-000000000001' and source_record_id = 'square-order-1-line-1'),
  'ITEM-A:VAR-A',
  'Square sync persists catalog and variation identity separately from the replay key'
);

select is(
  (select records_processed from public.sales_imports where restaurant_id = 'd0000000-0000-4000-8000-000000000001' order by imported_at desc, id desc limit 1),
  2,
  'completed import persists the truthful processed count'
);

select is(
  (select metadata->>'recordsProcessed' from public.activity_events where restaurant_id = 'd0000000-0000-4000-8000-000000000001' and event_type = 'pos_sync_completed' order by recorded_at desc, id desc limit 1),
  '2',
  'POS activity carries the truthful processed count'
);

select lives_ok(
  $sql$
    select public.service_apply_square_sync_result(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000101',
      '[
        {"source_record_id":"square-order-1-line-1","sale_date":"2026-08-10","item_name":"Burger","category":"Square","quantity_sold":2,"gross_sales":24,"net_sales":24,"provider_catalog_item_id":"ITEM-A","provider_variation_id":"VAR-A"},
        {"source_record_id":"square-order-1-line-2","sale_date":"2026-08-10","item_name":"Fries","category":"Square","quantity_sold":1,"gross_sales":6,"net_sales":6}
      ]'::jsonb,
      '[]'::jsonb,
      null,
      '2026-08-10'::date,
      '2026-08-10'::date
    )
  $sql$,
  'an exact Square sync replay succeeds idempotently'
);

select is(
  (select count(*) from public.pos_sales where restaurant_id = 'd0000000-0000-4000-8000-000000000001'),
  2::bigint,
  'an exact replay does not duplicate logical sales rows'
);

select lives_ok(
  $sql$
    select public.service_apply_square_sync_result(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000101',
      '[
        {"source_record_id":"square-order-1-line-2","sale_date":"2026-08-10","item_name":"Fries","category":"Square","quantity_sold":1,"gross_sales":6,"net_sales":6},
        {"source_record_id":"square-order-2-line-1","sale_date":"2026-08-11","item_name":"Burger","category":"Square","quantity_sold":1,"gross_sales":12,"net_sales":12}
      ]'::jsonb,
      '[]'::jsonb,
      null,
      '2026-08-10'::date,
      '2026-08-11'::date
    )
  $sql$,
  'an overlapping Square window succeeds'
);

select is(
  (select count(*) from public.pos_sales where restaurant_id = 'd0000000-0000-4000-8000-000000000001'),
  3::bigint,
  'the overlapping row is deduplicated while the new provider row is retained'
);

reset role;
select * from finish();
rollback;

