begin;

select plan(12);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ca111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'catalog-absence@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('ca000000-0000-4000-8000-000000000001', 'Catalog Absence Kitchen', 'Cafe', 'UTC'),
  ('ca000000-0000-4000-8000-000000000002', 'Other Tenant Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'ca000000-0000-4000-8000-000000000001',
  'ca111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.pos_integrations (id, restaurant_id, provider, status) values
  ('ca000000-0000-4000-8000-000000000101', 'ca000000-0000-4000-8000-000000000001', 'square', 'connected'),
  ('ca000000-0000-4000-8000-000000000201', 'ca000000-0000-4000-8000-000000000002', 'square', 'connected');

insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
) values
  (
    'ca000000-0000-4000-8000-000000000102',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000101',
    'absence-location', 'Absence Location', 'UTC', 'active'
  ),
  (
    'ca000000-0000-4000-8000-000000000202',
    'ca000000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000201',
    'other-location', 'Other Location', 'UTC', 'active'
  );

insert into public.menu_items (id, restaurant_id, name, category, active) values
  ('ca000000-0000-4000-8000-000000000301', 'ca000000-0000-4000-8000-000000000001', 'Keep Burger', 'Square', true),
  ('ca000000-0000-4000-8000-000000000302', 'ca000000-0000-4000-8000-000000000001', 'Gone Fries', 'Square', true),
  ('ca000000-0000-4000-8000-000000000303', 'ca000000-0000-4000-8000-000000000001', 'Manual Special', 'Manual', true),
  ('ca000000-0000-4000-8000-000000000401', 'ca000000-0000-4000-8000-000000000002', 'Other Tenant Dish', 'Square', true);

insert into public.pos_catalog_item_mappings (
  id, restaurant_id, pos_location_id, external_catalog_item_id, external_variation_id,
  external_name, menu_item_id, verification_status, confidence, effective_from
) values
  (
    'ca000000-0000-4000-8000-000000000501',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000102',
    'ITEM-KEEP', 'VAR-KEEP', 'Keep Burger',
    'ca000000-0000-4000-8000-000000000301', 'verified', 1, now() - interval '1 day'
  ),
  (
    'ca000000-0000-4000-8000-000000000502',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000102',
    'ITEM-GONE', 'VAR-GONE', 'Gone Fries',
    'ca000000-0000-4000-8000-000000000302', 'verified', 1, now() - interval '1 day'
  ),
  (
    'ca000000-0000-4000-8000-000000000503',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000102',
    'ITEM-DRAFT-GONE', 'VAR-DRAFT-GONE', 'Draft Gone',
    'ca000000-0000-4000-8000-000000000302', 'draft', 0, now() - interval '1 day'
  ),
  (
    'ca000000-0000-4000-8000-000000000601',
    'ca000000-0000-4000-8000-000000000002',
    'ca000000-0000-4000-8000-000000000202',
    'ITEM-OTHER', 'VAR-OTHER', 'Other Tenant Dish',
    'ca000000-0000-4000-8000-000000000401', 'verified', 1, now() - interval '1 day'
  );

select ok(
  not has_function_privilege(
    'authenticated',
    'private.reconcile_square_catalog_absence(uuid,uuid,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'private.reconcile_square_catalog_absence(uuid,uuid,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'private.service_apply_square_sync_result_scoped_pre_catalog_absence(uuid,uuid,uuid,uuid,text,jsonb,jsonb,text,date,date)',
    'execute'
  ),
  'catalog absence reconciliation stays private to the trusted scoped apply wrapper'
);

create temporary table catalog_absence_tokens (label text primary key, token uuid) on commit drop;

insert into catalog_absence_tokens values (
  'partial-preserve',
  (private.service_begin_square_authority_sync(
    'ca111111-1111-4111-8111-111111111111',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000101',
    'partial', current_date - 2, current_date
  )->>'syncToken')::uuid
);

select is(
  (
    private.service_apply_square_sync_result_scoped(
      'ca111111-1111-4111-8111-111111111111',
      'ca000000-0000-4000-8000-000000000001',
      'ca000000-0000-4000-8000-000000000101',
      (select token from catalog_absence_tokens where label = 'partial-preserve'),
      'partial',
      '[]'::jsonb,
      '[{"external_catalog_item_id":"ITEM-KEEP","external_variation_id":"VAR-KEEP","external_name":"Keep Burger","category":"Square"}]'::jsonb,
      null, current_date - 2, current_date
    )->>'catalogAbsenceReconciled'
  ),
  'false',
  'partial webhook snapshots never reconcile catalog absence'
);

select is(
  (select count(*) from public.pos_catalog_item_mappings
    where restaurant_id = 'ca000000-0000-4000-8000-000000000001'
      and effective_to is null),
  3::bigint,
  'partial refresh leaves current mappings open even when the snapshot omits deleted items'
);

insert into catalog_absence_tokens values (
  'full-reconcile',
  (private.service_begin_square_authority_sync(
    'ca111111-1111-4111-8111-111111111111',
    'ca000000-0000-4000-8000-000000000001',
    'ca000000-0000-4000-8000-000000000101',
    'full', current_date - 27, current_date
  )->>'syncToken')::uuid
);

select is(
  (
    private.service_apply_square_sync_result_scoped(
      'ca111111-1111-4111-8111-111111111111',
      'ca000000-0000-4000-8000-000000000001',
      'ca000000-0000-4000-8000-000000000101',
      (select token from catalog_absence_tokens where label = 'full-reconcile'),
      'full',
      jsonb_build_array(jsonb_build_object(
        'source_record_id', 'square-absence-line',
        'sale_date', current_date,
        'item_name', 'Keep Burger',
        'category', 'Square',
        'quantity_sold', 1,
        'gross_sales', 12,
        'net_sales', 12,
        'provider_location_id', 'absence-location',
        'provider_variation_id', 'VAR-KEEP'
      )),
      '[{"external_catalog_item_id":"ITEM-KEEP","external_variation_id":"VAR-KEEP","external_name":"Keep Burger","category":"Square"}]'::jsonb,
      null, current_date - 27, current_date
    )->>'catalogAbsentClosed'
  )::integer,
  2,
  'full snapshot soft-closes current mappings absent from the provider catalog'
);

select is(
  (select verification_status from public.pos_catalog_item_mappings
    where id = 'ca000000-0000-4000-8000-000000000501'),
  'verified',
  'present catalog identities remain current and keep their verification status'
);

select ok(
  (select effective_to is null from public.pos_catalog_item_mappings
    where id = 'ca000000-0000-4000-8000-000000000501'),
  'present catalog mappings stay open after full reconciliation'
);

select is(
  (select verification_status from public.pos_catalog_item_mappings
    where id = 'ca000000-0000-4000-8000-000000000502'),
  'expired',
  'absent verified mappings are marked expired instead of deleted'
);

select ok(
  (select effective_to is not null from public.pos_catalog_item_mappings
    where id = 'ca000000-0000-4000-8000-000000000502'),
  'absent mappings receive an effective_to close timestamp'
);

select ok(
  (select active = false from public.menu_items
    where id = 'ca000000-0000-4000-8000-000000000302'),
  'menu items left without any current Square mapping are deactivated'
);

select ok(
  (select active = true from public.menu_items
    where id = 'ca000000-0000-4000-8000-000000000301'),
  'menu items still covered by a current mapping stay active'
);

select ok(
  (select active = true from public.menu_items
    where id = 'ca000000-0000-4000-8000-000000000303'),
  'manual menu items without Square mappings are not deactivated by catalog absence'
);

select ok(
  (select effective_to is null and verification_status = 'verified'
    from public.pos_catalog_item_mappings
    where id = 'ca000000-0000-4000-8000-000000000601'),
  'full reconciliation never closes another restaurant catalog mapping'
);

reset role;
select * from finish();
rollback;
