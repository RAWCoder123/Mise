create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_supersede_target_evidence.test.sql
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
  ('d1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'supersede-target-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000d', 'Supersede Target Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000d', 'd1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000091', 'd0000000-0000-4000-8000-00000000000d', 'Evidence Produce', 'evidence produce'),
  ('d0000000-0000-4000-8000-000000000092', 'd0000000-0000-4000-8000-00000000000d', 'Other Produce', 'other produce');

-- Original purchase that forged corrections will try to supersede.
insert into public.purchase_lines (
  id, restaurant_id, supplier_id, source, source_document_reference, line_index,
  revision, raw_item_description, normalized_item_key, quantity, unit_of_measure,
  unit_price, extended_price, currency, transaction_date,
  correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
) values (
  'd0000000-0000-4000-8000-0000000000a1',
  'd0000000-0000-4000-8000-00000000000d',
  'd0000000-0000-4000-8000-000000000091',
  'invoice', 'INV-SUPERSEDE-TARGET', 0,
  0, 'Onions', 'onions', 10, 'lb',
  2, 20, 'USD', '2026-11-26',
  gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
  'd1111111-1111-4111-8111-11111111111d'
);

-- Sibling line on the same document (different index) used for line-index forge.
insert into public.purchase_lines (
  id, restaurant_id, supplier_id, source, source_document_reference, line_index,
  revision, raw_item_description, normalized_item_key, quantity, unit_of_measure,
  unit_price, extended_price, currency, transaction_date,
  correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
) values (
  'd0000000-0000-4000-8000-0000000000a2',
  'd0000000-0000-4000-8000-00000000000d',
  'd0000000-0000-4000-8000-000000000091',
  'invoice', 'INV-SUPERSEDE-TARGET', 1,
  0, 'Carrots', 'carrots', 5, 'lb',
  1, 5, 'USD', '2026-11-26',
  gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
  'd1111111-1111-4111-8111-11111111111d'
);

select has_function(
  'private',
  'enforce_purchase_line_supersede_target_evidence',
  'supersede target evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000092',
      'manual_entry', 'INV-SUPERSEDE-TARGET', 0,
      1, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'purchase',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Purchase line correction must preserve supplier identity',
  'direct insert rejects cross-supplier supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'manual_entry', 'INV-OTHER-DOC', 0,
      1, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'purchase',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Purchase line correction must preserve document identity',
  'direct insert rejects cross-document supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'manual_entry', 'INV-SUPERSEDE-TARGET', 1,
      1, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'purchase',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Purchase line correction must preserve line index',
  'direct insert rejects line-index-mismatched supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'manual_entry', 'INV-SUPERSEDE-TARGET', 0,
      1, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'credit',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Purchase line correction must preserve line type',
  'direct insert rejects line-type-mismatched supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'manual_entry', 'INV-SUPERSEDE-TARGET', 0,
      2, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'purchase',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Purchase line correction revision must follow the superseded line',
  'direct insert rejects non-contiguous supersession revision'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      id, restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, supersedes_line_id, raw_item_description, normalized_item_key,
      quantity, unit_of_measure, unit_price, extended_price, currency,
      transaction_date, correlation_id, parse_confidence, line_type,
      consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-0000000000b1',
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'manual_entry', 'INV-SUPERSEDE-TARGET', 0,
      1, 'd0000000-0000-4000-8000-0000000000a1',
      'Onions', 'onions', 8, 'lb', 2, 16, 'USD',
      '2026-11-26', gen_random_uuid(), 'confirmed', 'purchase',
      array[]::text[], 'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct insert accepts identity-preserving supersession'
);

select is(
  (select revision::text || '|' || (supersedes_line_id = 'd0000000-0000-4000-8000-0000000000a1')::text
     || '|' || quantity::text
   from public.purchase_lines
   where id = 'd0000000-0000-4000-8000-0000000000b1'),
  '1|true|8',
  'accepted direct supersession stores contiguous revision and quantity'
);

-- Revision-0 inserts without supersedes_line_id remain accepted.
select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-000000000091',
      'invoice', 'INV-SUPERSEDE-BASELINE-OK', 0,
      'Celery', 'celery', 3, 'lb',
      1, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      'd1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct insert still accepts revision-0 lines without supersedes_line_id'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-11111111111d', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select correction.revision::text || '|' || (correction.supersedes_line_id = original.id)::text
      || '|' || correction.quantity::text || '|' || correction.line_type
      || '|' || correction.source_document_reference
    from public.purchase_lines original
    cross join lateral (
      select * from public.supersede_purchase_line(
        'd0000000-0000-4000-8000-00000000000d',
        original.id,
        '{"lineType":"purchase","rawItemDescription":"Carrots","quantity":4,"unitOfMeasure":"lb",
          "unitPrice":1,"extendedPrice":4,"currency":"USD",
          "transactionDate":"2026-11-26","parseConfidence":"confirmed"}'::jsonb
      )
    ) correction
    where original.id = 'd0000000-0000-4000-8000-0000000000a2'
  ),
  '1|true|4|purchase|INV-SUPERSEDE-TARGET',
  'RPC supersede still accepts identity-preserving corrections'
);

select is(
  (select quantity::text from public.purchase_lines
   where id = 'd0000000-0000-4000-8000-0000000000a2'),
  '5',
  'RPC supersede leaves the original line unchanged'
);

select is(
  pg_temp.error_of($sql$
    select public.supersede_purchase_line(
      'd0000000-0000-4000-8000-00000000000d',
      'd0000000-0000-4000-8000-0000000000a2',
      '{"lineType":"purchase","rawItemDescription":"Carrots","quantity":3,"unitOfMeasure":"lb",
        "unitPrice":1,"extendedPrice":3,"currency":"USD",
        "transactionDate":"2026-11-26","parseConfidence":"confirmed"}'::jsonb
    )
  $sql$),
  'Purchase line has already been corrected',
  'RPC still rejects a second supersession of the same target'
);

reset role;

select * from finish();
rollback;
