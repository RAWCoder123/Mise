create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_consistency_flags_evidence.test.sql
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
  ('f1111111-1111-4111-8111-11111111111b', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'consistency-flags-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-00000000000b', 'Consistency Flags Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-00000000000b', 'f1111111-1111-4111-8111-11111111111b', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000091', 'f0000000-0000-4000-8000-00000000000b', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_consistency_flags_evidence',
  'consistency flags evidence guard exists'
);

select has_function(
  'private',
  'purchase_line_expected_consistency_flags',
  'stored-shape consistency flags reconstruction exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000b', 'invoice', 'INV-FLAGS-FORGE-EMPTY', 0,
      'Onions', 'onions', 10, 'lb',
      1, 50, 'USD', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase', array[]::text[],
      'f1111111-1111-4111-8111-11111111111b'
    )
  $sql$),
  'Purchase line consistency flags must match the recorded line evidence',
  'direct insert rejects forged empty consistency_flags over a price mismatch'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date, received_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000b', 'invoice', 'INV-FLAGS-FORGE-DATE', 0,
      'Onions', 'onions', 2, 'lb',
      3, 6, 'USD', '2026-11-26', '2026-11-27',
      gen_random_uuid(), 'estimated', 'purchase',
      array['received_before_transaction']::text[],
      'f1111111-1111-4111-8111-11111111111b'
    )
  $sql$),
  'Purchase line consistency flags must match the recorded line evidence',
  'direct insert rejects invented received_before_transaction flags'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000b', 'invoice', 'INV-FLAGS-OK-MISMATCH', 0,
      'Onions', 'onions', 10, 'lb',
      1, 50, 'USD', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      array['extended_price_mismatch']::text[],
      'f1111111-1111-4111-8111-11111111111b'
    )
  $sql$),
  null,
  'direct insert accepts matching extended_price_mismatch flags'
);

select is(
  (select consistency_flags from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000b'
      and source_document_reference = 'INV-FLAGS-OK-MISMATCH'),
  array['extended_price_mismatch']::text[],
  'matching extended_price_mismatch flags are stored exactly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-11111111111b', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'f0000000-0000-4000-8000-00000000000b',
      'invoice',
      'INV-RPC-FLAGS-MISMATCH',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "quantity":10,"unitOfMeasure":"lb","unitPrice":1,"extendedPrice":50,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed"}
      ]$json$::jsonb,
      'f0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  null,
  'RPC price-mismatch ingest still records with reconstructed flags'
);

select is(
  (select consistency_flags || ARRAY[parse_confidence]::text[]
     from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000b'
      and source_document_reference = 'INV-RPC-FLAGS-MISMATCH'),
  array['extended_price_mismatch', 'could_not_verify']::text[],
  'RPC stores matching extended_price_mismatch and lowered confidence'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'f0000000-0000-4000-8000-00000000000b',
      'invoice',
      'INV-RPC-FLAGS-CLEAN',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions",
         "quantity":2,"unitOfMeasure":"lb","unitPrice":3,"extendedPrice":6,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed"}
      ]$json$::jsonb,
      'f0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  null,
  'RPC clean ingest still records with empty consistency_flags'
);

select is(
  (select consistency_flags from public.purchase_lines
    where restaurant_id = 'f0000000-0000-4000-8000-00000000000b'
      and source_document_reference = 'INV-RPC-FLAGS-CLEAN'),
  array[]::text[],
  'RPC stores empty consistency_flags for a clean line'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'f0000000-0000-4000-8000-00000000000b', 'invoice', 'INV-FLAGS-OK-CLEAN', 0,
      'Onions', 'onions', 2, 'lb',
      3, 6, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      'f1111111-1111-4111-8111-11111111111b'
    )
  $sql$),
  null,
  'direct insert accepts empty consistency_flags for a clean line'
);

select is(
  (select consistency_flags
     is not distinct from private.purchase_line_expected_consistency_flags(
       quantity, unit_of_measure, pack_size, unit_price, extended_price,
       transaction_date, received_date, raw_item_description
     )
   from public.purchase_lines
   where restaurant_id = 'f0000000-0000-4000-8000-00000000000b'
     and source_document_reference = 'INV-FLAGS-OK-CLEAN'),
  true,
  'accepted clean row still matches expected consistency_flags reconstruction'
);

select * from finish();
rollback;
