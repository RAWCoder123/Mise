create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -c '^select is(\|^select isnt(\|^select throws_ok(' purchase_line_item_links.test.sql
select plan(18);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('6a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'link-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('6a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'link-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('6b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'link-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('6a000000-0000-4000-8000-000000000001', 'Link Kitchen', 'Cafe', 'UTC'),
  ('6b000000-0000-4000-8000-000000000001', 'Other Link Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('6a000000-0000-4000-8000-000000000001', '6a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('6a000000-0000-4000-8000-000000000001', '6a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('6b000000-0000-4000-8000-000000000001', '6b111111-1111-4111-8111-111111111111', 'owner', 'active');
insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('6a000000-0000-4000-8000-000000000101', '6a000000-0000-4000-8000-000000000001', 'Metro Produce', 'metro produce'),
  ('6b000000-0000-4000-8000-000000000101', '6b000000-0000-4000-8000-000000000001', 'Other Produce', 'other produce');
insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
) values
  ('6a000000-0000-4000-8000-000000000201', '6a000000-0000-4000-8000-000000000001',
   'Chicken Thighs Boneless 40 LB Case', 'protein', 'case', 4, 8, 3, 70,
   '6a000000-0000-4000-8000-000000000101', 'Metro Produce'),
  ('6b000000-0000-4000-8000-000000000201', '6b000000-0000-4000-8000-000000000001',
   'Chicken Thighs Boneless 40 LB Case', 'protein', 'case', 4, 8, 3, 70,
   '6b000000-0000-4000-8000-000000000101', 'Other Produce');

select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.ingest_purchase_lines(
  '6a000000-0000-4000-8000-000000000001',
  'invoice',
  'INV-LINK-4471',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'purchase',
      'rawItemDescription', 'CHICKEN THIGHS, BONELESS - 40 LB CASE',
      'quantity', 2,
      'unitOfMeasure', 'case',
      'unitPrice', 86.5,
      'extendedPrice', 173,
      'currency', 'USD',
      'transactionDate', '2026-09-10',
      'parseConfidence', 'confirmed'
    )
  ),
  '6a000000-0000-4000-8000-000000000101',
  null
);

select is(
  (select normalized_item_key from public.purchase_lines
    where source_document_reference = 'INV-LINK-4471' and line_index = 0),
  'chicken thighs boneless case',
  'ingested line exposes the deterministic key managers will verify'
);

select is(
  (public.link_purchase_line_item(
    '6a000000-0000-4000-8000-000000000001',
    'chicken thighs boneless case',
    '6a000000-0000-4000-8000-000000000201',
    '6a000000-0000-4000-8000-000000000101'
  )).status,
  'verified',
  'manager can verify a purchase-line key against same-tenant inventory'
);

select is(
  (select count(*) from public.purchase_line_item_links
    where restaurant_id = '6a000000-0000-4000-8000-000000000001'
      and status = 'verified'),
  1::bigint,
  'one verified link exists after first verification'
);

select is(
  (public.link_purchase_line_item(
    '6a000000-0000-4000-8000-000000000001',
    'chicken thighs boneless case',
    '6a000000-0000-4000-8000-000000000201',
    '6a000000-0000-4000-8000-000000000101'
  )).inventory_item_id,
  '6a000000-0000-4000-8000-000000000201'::uuid,
  'identical verification is idempotent'
);

select is(
  (public.apply_purchase_line_linked_unit_cost(
    '6a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_line_item_links
      where restaurant_id = '6a000000-0000-4000-8000-000000000001'
        and status = 'verified'
      limit 1)
  )).estimated_unit_cost,
  86.5::numeric,
  'manager can apply the newest confirmed invoice unit price'
);

select is(
  (select estimated_unit_cost from public.inventory_items
    where id = '6a000000-0000-4000-8000-000000000201'),
  86.5::numeric,
  'inventory estimated cost persists the applied invoice price'
);

select is(
  (public.revoke_purchase_line_item_link(
    '6a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_line_item_links
      where restaurant_id = '6a000000-0000-4000-8000-000000000001'
        and status = 'verified'
      limit 1)
  )).status,
  'revoked',
  'manager can revoke a verified link'
);

select is(
  pg_temp.error_of($sql$
    select public.apply_purchase_line_linked_unit_cost(
      '6a000000-0000-4000-8000-000000000001',
      (select id from public.purchase_line_item_links
        where restaurant_id = '6a000000-0000-4000-8000-000000000001'
        order by linked_at desc limit 1)
    )
  $sql$),
  'Verified purchase line item link is required',
  'revoked links cannot apply unit cost'
);

select set_config('request.jwt.claim.sub', '6a222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.error_of($sql$
    select public.link_purchase_line_item(
      '6a000000-0000-4000-8000-000000000001',
      'chicken thighs boneless case',
      '6a000000-0000-4000-8000-000000000201',
      '6a000000-0000-4000-8000-000000000101'
    )
  $sql$),
  'Not authorized for this restaurant',
  'staff cannot verify purchase-line inventory links'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_line_item_links (
      restaurant_id, normalized_item_key, inventory_item_id, status, linked_by
    ) values (
      '6a000000-0000-4000-8000-000000000001',
      'chicken thighs boneless case',
      '6a000000-0000-4000-8000-000000000201',
      'verified',
      '6a222222-2222-4222-8222-222222222222'
    )
  $sql$),
  'permission denied for table purchase_line_item_links',
  'authenticated clients cannot insert links directly'
);

select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.error_of($sql$
    select public.link_purchase_line_item(
      '6a000000-0000-4000-8000-000000000001',
      'chicken thighs boneless case',
      '6b000000-0000-4000-8000-000000000201',
      '6a000000-0000-4000-8000-000000000101'
    )
  $sql$),
  'Inventory item not found for restaurant',
  'cross-tenant inventory ids fail closed'
);

select is(
  pg_temp.error_of($sql$
    select public.link_purchase_line_item(
      '6a000000-0000-4000-8000-000000000001',
      'chicken thighs boneless case',
      '6a000000-0000-4000-8000-000000000201',
      '6b000000-0000-4000-8000-000000000101'
    )
  $sql$),
  'Supplier identity is not available for this restaurant',
  'cross-tenant supplier ids fail closed'
);

select set_config('request.jwt.claim.sub', '6b111111-1111-4111-8111-111111111111', true);
select is(
  (select count(*) from public.purchase_line_item_links
    where restaurant_id = '6a000000-0000-4000-8000-000000000001'),
  0::bigint,
  'other-tenant members cannot read foreign purchase-line links'
);

select is(
  pg_temp.error_of($sql$
    select public.link_purchase_line_item(
      '6a000000-0000-4000-8000-000000000001',
      'chicken thighs boneless case',
      '6a000000-0000-4000-8000-000000000201',
      '6a000000-0000-4000-8000-000000000101'
    )
  $sql$),
  'Not authorized for this restaurant',
  'other-tenant owners cannot mutate foreign restaurant links'
);

select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select is(
  (select count(*) from public.activity_events
    where restaurant_id = '6a000000-0000-4000-8000-000000000001'
      and event_type = 'purchase_line_item_linked'),
  1::bigint,
  'successful verification writes activity evidence'
);

select is(
  (select count(*) from public.audit_logs
    where restaurant_id = '6a000000-0000-4000-8000-000000000001'
      and action = 'purchase_line_linked_unit_cost_applied'),
  1::bigint,
  'unit-cost apply writes audit evidence'
);

select is(
  has_table_privilege('authenticated', 'public.purchase_line_item_links', 'INSERT'),
  false,
  'authenticated has no insert privilege on purchase_line_item_links'
);

select is(
  has_table_privilege('authenticated', 'public.purchase_line_item_links', 'UPDATE'),
  false,
  'authenticated has no update privilege on purchase_line_item_links'
);

select * from finish();
rollback;
