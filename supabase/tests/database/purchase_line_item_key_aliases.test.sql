create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -c '^select is(\|^select isnt(\|^select throws_ok(' purchase_line_item_key_aliases.test.sql
select plan(16);

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
  ('7a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alias-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alias-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alias-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('7a000000-0000-4000-8000-000000000001', 'Alias Kitchen', 'Cafe', 'UTC'),
  ('7b000000-0000-4000-8000-000000000001', 'Other Alias Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('7a000000-0000-4000-8000-000000000001', '7a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('7a000000-0000-4000-8000-000000000001', '7a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('7b000000-0000-4000-8000-000000000001', '7b111111-1111-4111-8111-111111111111', 'owner', 'active');
insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('7a000000-0000-4000-8000-000000000101', '7a000000-0000-4000-8000-000000000001', 'Metro Produce', 'metro produce'),
  ('7b000000-0000-4000-8000-000000000101', '7b000000-0000-4000-8000-000000000001', 'Other Produce', 'other produce');

select set_config('request.jwt.claim.sub', '7a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'invoice',
  'INV-ALIAS-4471',
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
  '7a000000-0000-4000-8000-000000000101',
  null
);

select public.ingest_purchase_lines(
  '7a000000-0000-4000-8000-000000000001',
  'credit_memo',
  'CM-ALIAS-4471',
  jsonb_build_array(
    jsonb_build_object(
      'lineIndex', 0,
      'lineType', 'credit',
      'rawItemDescription', 'CHICKEN THIGH BONELESS',
      'quantity', 1,
      'unitOfMeasure', 'case',
      'unitPrice', 86.5,
      'extendedPrice', 86.5,
      'currency', 'USD',
      'transactionDate', '2026-09-11',
      'parseConfidence', 'confirmed'
    )
  ),
  '7a000000-0000-4000-8000-000000000101',
  null
);

select is(
  (select normalized_item_key from public.purchase_lines
    where source_document_reference = 'INV-ALIAS-4471' and line_index = 0),
  'chicken thighs boneless case',
  'invoice exposes the canonical purchase key'
);

select is(
  (select normalized_item_key from public.purchase_lines
    where source_document_reference = 'CM-ALIAS-4471' and line_index = 0),
  'chicken thigh boneless',
  'credit memo keeps its distinct exact key'
);

select is(
  (select unmatched_credit from public.list_purchase_line_net_by_item(
    '7a000000-0000-4000-8000-000000000001'
  ) where normalized_item_key = 'chicken thigh boneless'),
  true,
  'before aliasing the credit group is flagged unmatched'
);

select is(
  (public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'chicken thigh boneless',
    'chicken thighs boneless case',
    '7a000000-0000-4000-8000-000000000101'
  )).status,
  'verified',
  'manager can verify an exact item-key alias'
);

select is(
  (select count(*) from public.purchase_line_item_key_aliases
    where restaurant_id = '7a000000-0000-4000-8000-000000000001'
      and status = 'verified'),
  1::bigint,
  'one verified alias exists after first verification'
);

select is(
  (public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'chicken thigh boneless',
    'chicken thighs boneless case',
    '7a000000-0000-4000-8000-000000000101'
  )).canonical_item_key,
  'chicken thighs boneless case',
  'identical alias verification is idempotent'
);

select is(
  (select net_quantity::text || '|' || unmatched_credit::text
   from public.list_purchase_line_net_by_item('7a000000-0000-4000-8000-000000000001')
   where normalized_item_key = 'chicken thighs boneless case'),
  '1|false',
  'aliased credit nets into the invoice group'
);

select is(
  (select count(*) from public.list_purchase_line_net_by_item(
    '7a000000-0000-4000-8000-000000000001'
  ) where normalized_item_key = 'chicken thigh boneless'),
  0::bigint,
  'aliased credit key no longer forms its own unmatched group'
);

select is(
  pg_temp.error_of($sql$select public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'chicken thighs boneless case',
    'another key',
    '7a000000-0000-4000-8000-000000000101'
  )$sql$),
  'Alias purchase item key is already a canonical target',
  'alias that is already a canonical target is refused'
);

select is(
  pg_temp.error_of($sql$select public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'extra credit key',
    'chicken thigh boneless',
    '7a000000-0000-4000-8000-000000000101'
  )$sql$),
  'Canonical purchase item key is already an alias source',
  'canonical key that is already an alias source is refused'
);

select set_config('request.jwt.claim.sub', '7a222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.error_of($sql$select public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'staff key',
    'chicken thighs boneless case',
    '7a000000-0000-4000-8000-000000000101'
  )$sql$),
  'Not authorized for this restaurant',
  'staff cannot create aliases'
);

select set_config('request.jwt.claim.sub', '7b111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.error_of($sql$select public.alias_purchase_line_item_key(
    '7a000000-0000-4000-8000-000000000001',
    'foreign key',
    'chicken thighs boneless case',
    '7a000000-0000-4000-8000-000000000101'
  )$sql$),
  'Not authorized for this restaurant',
  'cross-tenant actors cannot create aliases'
);

select set_config('request.jwt.claim.sub', '7a111111-1111-4111-8111-111111111111', true);
select is(
  (public.revoke_purchase_line_item_key_alias(
    '7a000000-0000-4000-8000-000000000001',
    (select id from public.purchase_line_item_key_aliases
      where restaurant_id = '7a000000-0000-4000-8000-000000000001'
        and status = 'verified'
      limit 1)
  )).status,
  'revoked',
  'manager can revoke a verified alias'
);

select is(
  (select unmatched_credit from public.list_purchase_line_net_by_item(
    '7a000000-0000-4000-8000-000000000001'
  ) where normalized_item_key = 'chicken thigh boneless'),
  true,
  'after revoke the credit group is unmatched again'
);

select is(
  (select count(*)::int from public.purchase_line_item_key_aliases
    where restaurant_id = '7b000000-0000-4000-8000-000000000001'),
  0,
  'alias rows stay tenant-local'
);

select is(
  (select count(*) from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'purchase_line_item_key_aliases'
      and cmd = 'SELECT'),
  1::bigint,
  'aliases expose a membership SELECT policy only'
);

select * from finish();
rollback;
