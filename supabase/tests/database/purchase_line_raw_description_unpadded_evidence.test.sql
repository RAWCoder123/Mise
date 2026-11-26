create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_raw_description_unpadded_evidence.test.sql
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
  ('e1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'raw-desc-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000a', 'Raw Description Unpadded Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000a', 'e1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000090', 'e0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_raw_description_unpadded_evidence',
  'raw description unpadded evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-RAW-BLANK', 0,
      '   ', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'e1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line raw item description must be non-blank and unpadded',
  'direct insert rejects whitespace-only raw_item_description'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-RAW-CNTRL', 0,
      E'\t\n', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'e1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line raw item description must be non-blank and unpadded',
  'direct insert rejects tab/newline-only raw_item_description'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-RAW-PAD', 0,
      '  Onions  ', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'e1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  'Purchase line raw item description must be non-blank and unpadded',
  'direct insert rejects padded raw_item_description'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'e0000000-0000-4000-8000-00000000000a',
      'invoice',
      'INV-RPC-RAW-BLANK',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"   ",
         "transactionDate":"2026-11-26","parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'e0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  'Purchase line 0 has no readable source description',
  'RPC blank rawItemDescription still fails closed as required'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'e0000000-0000-4000-8000-00000000000a',
      'invoice',
      'INV-RPC-RAW-PAD',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"  Onions  ",
         "transactionDate":"2026-11-26","parseConfidence":"could_not_verify"}
      ]$json$::jsonb,
      'e0000000-0000-4000-8000-000000000090'
    )
  $sql$),
  null,
  'RPC padded rawItemDescription still trims and records'
);

select is(
  (select raw_item_description from public.purchase_lines
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-RPC-RAW-PAD'),
  'Onions',
  'RPC padded rawItemDescription stores the trimmed label'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, transaction_date,
      correlation_id, parse_confidence, line_type, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000a', 'invoice', 'INV-RAW-OK', 0,
      'Onions', 'onions', '2026-11-26',
      gen_random_uuid(), 'could_not_verify', 'purchase',
      'e1111111-1111-4111-8111-11111111111a'
    )
  $sql$),
  null,
  'direct insert accepts a trimmed non-empty raw_item_description'
);

select is(
  (select raw_item_description from public.purchase_lines
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and source_document_reference = 'INV-RAW-OK'),
  'Onions',
  'trimmed non-empty raw_item_description is stored exactly'
);

select is(
  (select count(*) from public.purchase_lines
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000a'
      and source_document_reference in ('INV-RPC-RAW-PAD', 'INV-RAW-OK')),
  2::bigint,
  'legitimate trimmed raw item descriptions remain recordable'
);

select * from finish();
rollback;
