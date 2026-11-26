create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_unit_pack_unpadded_evidence.test.sql
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
  ('d1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'unit-pack-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000a', 'Unit Pack Unpadded Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000a', 'd1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000090', 'd0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_unit_pack_unpadded_evidence',
  'unit/pack unpadded evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, unit_of_measure,
      transaction_date, correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-UNIT-PAD', 0,
      'Onions', 'onions', '  lb  ',
      '2026-11-26', gen_random_uuid(), 'could_not_verify', 'purchase',
      'd1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line unit of measure must be unpadded when present',
  'direct insert rejects padded unit_of_measure'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, pack_size,
      transaction_date, correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-PACK-PAD', 0,
      'Onions', 'onions', '  6x12oz  ',
      '2026-11-26', gen_random_uuid(), 'could_not_verify', 'purchase',
      'd1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line pack size must be unpadded when present',
  'direct insert rejects padded pack_size'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'd0000000-0000-4000-8000-00000000000a',
      'invoice',
      'INV-RPC-UNIT',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "unitOfMeasure":"  lb  ","transactionDate":"2026-11-26",
         "parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'd0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  null,
  'RPC padded unitOfMeasure still trims and records'
);

select is(
  (select unit_of_measure from public.purchase_lines
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-RPC-UNIT'),
  'lb',
  'RPC padded unitOfMeasure stores the trimmed label'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'd0000000-0000-4000-8000-00000000000a',
      'invoice',
      'INV-RPC-PACK',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "packSize":"  6x12oz  ","transactionDate":"2026-11-26",
         "parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'd0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  null,
  'RPC padded packSize still trims and records'
);

select is(
  (select pack_size from public.purchase_lines
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-RPC-PACK'),
  '6x12oz',
  'RPC padded packSize stores the trimmed label'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, unit_of_measure, pack_size,
      transaction_date, correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-OK-TRIM', 0,
      'Onions', 'onions', 'lb', '6x12oz',
      '2026-11-26', gen_random_uuid(), 'could_not_verify', 'purchase',
      'd1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts trimmed unit_of_measure and pack_size'
);

select is(
  (select unit_of_measure || '|' || pack_size from public.purchase_lines
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-OK-TRIM'),
  'lb|6x12oz',
  'trimmed unit_of_measure and pack_size are stored exactly'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key,
      transaction_date, correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-OK-NULL', 0,
      'Onions', 'onions',
      '2026-11-26', gen_random_uuid(), 'could_not_verify', 'purchase',
      'd1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts null unit_of_measure and pack_size'
);

select is(
  (select unit_of_measure is null and pack_size is null from public.purchase_lines
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-OK-NULL'),
  true,
  'null unit_of_measure and pack_size remain allowed'
);

select is(
  (select count(*) from public.purchase_lines
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and source_document_reference in (
        'INV-RPC-UNIT', 'INV-RPC-PACK', 'INV-OK-TRIM', 'INV-OK-NULL'
      )),
  4::bigint,
  'legitimate trimmed unit and pack labels remain recordable'
);

select * from finish();
rollback;
