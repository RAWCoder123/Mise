begin;

select plan(22);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c5111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'square-authority-sync@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c5000000-0000-4000-8000-000000000001', 'Scoped Square Kitchen', 'Cafe', 'UTC'),
  ('c5000000-0000-4000-8000-000000000002', 'Untouched Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values ('c5000000-0000-4000-8000-000000000001',
  'c5111111-1111-4111-8111-111111111111', 'manager', 'active');
insert into public.pos_integrations (id, restaurant_id, provider, status) values (
  'c5000000-0000-4000-8000-000000000101',
  'c5000000-0000-4000-8000-000000000001', 'square', 'connected'
);
insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
) values (
  'c5000000-0000-4000-8000-000000000102',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  'authority-location', 'Authority Location', 'UTC', 'active'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id
) values
  ('c5000000-0000-4000-8000-000000000001', current_date, 'Toast row', 'Other', 1, 1, 1,
   'Toast', 'toast-untouched'),
  ('c5000000-0000-4000-8000-000000000002', current_date, 'Manual row', 'Manual', 1, 0, 0,
   'CSV Import', 'other-tenant-manual');

select ok(
  has_function_privilege('service_role',
    'public.service_begin_square_authority_sync(uuid,uuid,uuid,text,date,date)', 'execute')
  and has_function_privilege('service_role',
    'public.service_apply_square_sync_result_scoped(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,date,date)', 'execute')
  and not has_function_privilege('authenticated',
    'public.service_begin_square_authority_sync(uuid,uuid,uuid,text,date,date)', 'execute')
  and not has_function_privilege('service_role',
    'private.service_apply_square_sync_result_mise_003a_base(uuid,uuid,uuid,jsonb,jsonb,text,date,date)', 'execute'),
  'only the trusted service boundary can begin and complete Square authority synchronization'
);

create temporary table authority_sync_tokens (label text primary key, token uuid) on commit drop;
insert into authority_sync_tokens values (
  'full-one',
  (private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'full', current_date - 27, current_date
  )->>'syncToken')::uuid
);

select ok((private.service_apply_square_sync_result_scoped(
  'c5111111-1111-4111-8111-111111111111',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  (select token from authority_sync_tokens where label = 'full-one'),
  'full',
  jsonb_build_array(jsonb_build_object(
    'source_record_id', 'square-authority-line',
    'sale_date', current_date,
    'item_name', 'Authority Burger',
    'category', 'Square',
    'quantity_sold', 1,
    'gross_sales', 12,
    'net_sales', 12,
    'provider_location_id', 'authority-location',
    'provider_variation_id', 'VAR-AUTH'
  )),
  '[{"external_catalog_item_id":"ITEM-AUTH","external_variation_id":"VAR-AUTH","external_name":"Authority Burger","category":"Square"}]'::jsonb,
  null, current_date - 27, current_date
)->>'authorityWindowAttested')::boolean,
  'a full normal sync explicitly attests its exact 28-day snapshot');
select is((select provider_catalog_item_id from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000001'
    and source_record_id = 'square-authority-line'), 'ITEM-AUTH',
  'the trusted database path derives catalog item identity from variation plus catalog snapshot');
select ok((select authority_window_from = current_date - 27
    and authority_window_to = current_date
    and authority_window_completed_at is not null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'full sync persists the exact current authority window');
select ok((select authority_sync_token is null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'successful full sync releases its synchronization lease');

insert into authority_sync_tokens values (
  'partial-one',
  (private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'partial', current_date - 2, current_date
  )->>'syncToken')::uuid
);
select ok((select authority_window_from is null
    and authority_window_to is null
    and authority_window_completed_at is null
    and authority_sync_token is not null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'partial webhook work invalidates completeness before provider fetching begins');
select is(private.service_apply_square_sync_result_scoped(
  'c5111111-1111-4111-8111-111111111111',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  (select token from authority_sync_tokens where label = 'partial-one'),
  'partial',
  jsonb_build_array(jsonb_build_object(
    'source_record_id', 'square-authority-line',
    'sale_date', current_date,
    'item_name', 'Authority Burger',
    'category', 'Square',
    'quantity_sold', 2,
    'gross_sales', 24,
    'net_sales', 24,
    'provider_location_id', 'authority-location',
    'provider_variation_id', 'VAR-AUTH'
  )),
  '[{"external_catalog_item_id":"ITEM-AUTH","external_variation_id":"VAR-AUTH","external_name":"Authority Burger","category":"Square"}]'::jsonb,
  null, current_date - 2, current_date
)->>'authorityWindowAttested', 'false',
  'a two-day webhook refresh can never report that it attested a full purchasing window');
select is((select provider_catalog_item_id from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000001'
    and source_record_id = 'square-authority-line'), 'ITEM-AUTH',
  'webhook-originated raw sales receive the same derived catalog identity');
select ok((select authority_window_from is null
    and authority_window_to is null
    and authority_window_completed_at is null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'two-day webhook completion remains explicitly incomplete instead of stamping or shrinking a full window');

insert into authority_sync_tokens values (
  'partial-preserve',
  (private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'partial', current_date - 2, current_date
  )->>'syncToken')::uuid
);
select lives_ok($sql$
  select private.service_apply_square_sync_result_scoped(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    (select token from authority_sync_tokens where label = 'partial-preserve'),
    'partial',
    jsonb_build_array(jsonb_build_object(
      'source_record_id', 'square-authority-line',
      'sale_date', current_date,
      'item_name', 'Authority Burger',
      'category', 'Square',
      'quantity_sold', 3,
      'gross_sales', 36,
      'net_sales', 36,
      'provider_location_id', 'authority-location',
      'provider_variation_id', 'VAR-AUTH'
    )),
    '[]'::jsonb, null, current_date - 2, current_date
  )
$sql$, 'partial refresh with no catalog match fails closed by preserving an existing exact identity');
select is((select provider_catalog_item_id from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000001'
    and source_record_id = 'square-authority-line'), 'ITEM-AUTH',
  'an existing sale catalog identity is never overwritten with null by a partial refresh');

insert into authority_sync_tokens values (
  'full-zero',
  (private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'full', current_date - 27, current_date
  )->>'syncToken')::uuid
);
select ok((private.service_apply_square_sync_result_scoped(
  'c5111111-1111-4111-8111-111111111111',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  (select token from authority_sync_tokens where label = 'full-zero'),
  'full', '[]'::jsonb, '[]'::jsonb, null, current_date - 27, current_date
)->>'authorityWindowAttested')::boolean,
  'a fully paginated exact snapshot may legitimately attest zero Square sales');
select ok((select authority_window_from = current_date - 27
    and authority_window_to = current_date
    and authority_window_completed_at is not null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'zero-sale full completion preserves exact 28-day attestation metadata');
select is((select count(*) from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000001'
    and source_pos = 'Square'), 0::bigint,
  'zero-sale completeness is represented without inventing fake sales');

select throws_ok($sql$
  select private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'full', current_date - 2, current_date
  )
$sql$, '22023', 'Full Square authority sync must cover the exact current 28-day window',
  'a short normal sync cannot claim full-snapshot semantics');

insert into authority_sync_tokens values (
  'full-malformed',
  (private.service_begin_square_authority_sync(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    'full', current_date - 27, current_date
  )->>'syncToken')::uuid
);
select throws_ok($sql$
  select private.service_apply_square_sync_result_scoped(
    'c5111111-1111-4111-8111-111111111111',
    'c5000000-0000-4000-8000-000000000001',
    'c5000000-0000-4000-8000-000000000101',
    (select token from authority_sync_tokens where label = 'full-malformed'),
    'full',
    jsonb_build_array(jsonb_build_object(
      'source_record_id', 'malformed-identity',
      'sale_date', current_date,
      'item_name', 'Malformed Burger',
      'category', 'Square',
      'quantity_sold', 1,
      'gross_sales', 1,
      'net_sales', 1,
      'provider_location_id', 'authority-location',
      'provider_catalog_item_id', 'WRONG-ITEM',
      'provider_variation_id', 'VAR-AUTH'
    )),
    '[{"external_catalog_item_id":"ITEM-AUTH","external_variation_id":"VAR-AUTH","external_name":"Authority Burger","category":"Square"}]'::jsonb,
    null, current_date - 27, current_date
  )
$sql$, '22023', 'Square sale catalog identity disagrees with the catalog snapshot',
  'the database fails closed when caller-supplied catalog identity disagrees with provider catalog evidence');
select is(private.service_fail_square_authority_sync(
  'c5111111-1111-4111-8111-111111111111',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  (select token from authority_sync_tokens where label = 'full-malformed'),
  'malformed_provider_identity', current_date - 27, current_date
)->>'status', 'failed', 'a failed scoped sync releases only its own matching lease');
select ok((select authority_sync_token is null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'failure completion clears the in-progress marker without inventing authority');

select is((select count(*) from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000001'
    and source_record_id = 'toast-untouched'), 1::bigint,
  'Square replacement scopes leave other providers untouched');
select is((select count(*) from public.pos_sales
  where restaurant_id = 'c5000000-0000-4000-8000-000000000002'
    and source_record_id = 'other-tenant-manual'), 1::bigint,
  'Square replacement scopes leave other tenants and manual sales untouched');

select is(private.service_apply_square_sync_result(
  'c5111111-1111-4111-8111-111111111111',
  'c5000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000101',
  '[]'::jsonb, '[]'::jsonb, null, current_date - 1, current_date
)->>'authorityWindowAttested', 'false',
  'the historical unscoped service RPC is fail-closed to partial non-authoritative semantics');
select ok((select authority_window_from is null
    and authority_window_to is null
    and authority_window_completed_at is null
  from public.pos_integrations where id = 'c5000000-0000-4000-8000-000000000101'),
  'legacy callers cannot bypass explicit full-snapshot attestation');

select * from finish();
rollback;
