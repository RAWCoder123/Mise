create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_normalized_item_key_unpadded_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(12);

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
  ('f1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'norm-key-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000a', 'Normalized Key Unpadded Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000a', 'f1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000090', 'f0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_normalized_item_key_unpadded_evidence',
  'normalized item key unpadded evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-KEY-PAD', 0,
      'Onions', '  onions  ', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'f1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line normalized item key must be unpadded when present',
  'direct insert rejects padded normalized_item_key'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-KEY-TAB', 0,
      'Onions', E'\tonions\t', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'f1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line normalized item key must be unpadded when present',
  'direct insert rejects tab-padded normalized_item_key'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-KEY-MISMATCH', 0,
      'Onions', 'garlic', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'f1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'new row for relation "purchase_lines" violates check constraint "purchase_lines_normalized_key_check"',
  'direct insert still fails closed when key mismatches normalize_purchase_item_key'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'f0000000-0000-4000-8000-00000000000a',
      'invoice',
      'INV-RPC-KEY',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"  Onions  ",
         "transactionDate":"2026-11-26","parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'f0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  null,
  'RPC padded rawItemDescription still trims and records an unpadded key'
);

select is(
  (select raw_item_description || '|' || normalized_item_key from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-RPC-KEY'),
  'Onions|onions',
  'RPC stores trimmed description with matching unpadded normalized_item_key'
);

select is(
  (select normalized_item_key
     is not distinct from private.normalize_purchase_item_key(raw_item_description)
   from public.purchase_lines
   where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
     and source_document_reference = 'INV-RPC-KEY'),
  true,
  'RPC stored key still matches normalize_purchase_item_key'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-KEY-OK', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'f1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts a trimmed matching normalized_item_key'
);

select is(
  (select normalized_item_key from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-KEY-OK'),
  'onions',
  'trimmed matching normalized_item_key is stored exactly'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-KEY-NULL', 0,
      '!!!', null, '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'f1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts null normalized_item_key when normalize yields null'
);

select is(
  (select normalized_item_key is null from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-KEY-NULL'),
  true,
  'null normalized_item_key remains allowed'
);

select is(
  (select count(*) from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000a'
      and source_document_reference in (
        'INV-RPC-KEY', 'INV-KEY-OK', 'INV-KEY-NULL'
      )),
  3::bigint,
  'legitimate unpadded normalized item keys remain recordable'
);

select * from finish();
rollback;
