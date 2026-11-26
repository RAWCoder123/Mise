create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_document_reference_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(10);

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
  ('c1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'doc-ref-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000a', 'Document Reference Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000a', 'c1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000090', 'c0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_document_reference_evidence',
  'document reference evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000a', 'invoice', '   ', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'c1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line source document reference must be non-blank and unpadded',
  'direct insert rejects whitespace-only source_document_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000a', 'invoice', E'\t\n', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'c1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line source document reference must be non-blank and unpadded',
  'direct insert rejects tab/newline-only source_document_reference'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000a', 'invoice', '  INV-1  ', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'c1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line source document reference must be non-blank and unpadded',
  'direct insert rejects padded source_document_reference'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000a',
      'invoice',
      '   ',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "transactionDate":"2026-11-26","parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'c0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  'A source document reference is required',
  'RPC blank source_document_reference still fails closed as required'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000a',
      'invoice',
      '  INV-PADDED-1  ',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "transactionDate":"2026-11-26","parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'c0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  null,
  'RPC padded source_document_reference still trims and records'
);

select is(
  (select source_document_reference from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-PADDED-1'),
  'INV-PADDED-1',
  'RPC padded source_document_reference stores the trimmed label'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-OK-1', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'c1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts a trimmed non-empty source_document_reference'
);

select is(
  (select source_document_reference from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-OK-1'),
  'INV-OK-1',
  'trimmed non-empty source_document_reference is stored exactly'
);

select is(
  (select count(*) from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and source_document_reference in ('INV-PADDED-1', 'INV-OK-1')),
  2::bigint,
  'legitimate trimmed document references remain recordable'
);

select * from finish();
rollback;
