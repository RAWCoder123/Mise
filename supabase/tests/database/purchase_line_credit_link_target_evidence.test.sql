create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_credit_link_target_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(11);

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
  ('c1111111-1111-4111-8111-11111111111c', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'credit-link-target-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000c', 'Credit Link Target Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000c', 'c1111111-1111-4111-8111-11111111111c', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000091', 'c0000000-0000-4000-8000-00000000000c', 'Evidence Co', 'evidence co'),
  ('c0000000-0000-4000-8000-000000000092', 'c0000000-0000-4000-8000-00000000000c', 'Other Co', 'other co');

-- Seed one purchase per supplier and one unlinked credit under Evidence Co.
insert into public.purchase_lines (
  id, restaurant_id, supplier_id, source, source_document_reference, line_index,
  raw_item_description, normalized_item_key, quantity, unit_of_measure,
  unit_price, extended_price, currency, transaction_date,
  correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
) values
  (
    'c0000000-0000-4000-8000-0000000000a1',
    'c0000000-0000-4000-8000-00000000000c',
    'c0000000-0000-4000-8000-000000000091',
    'invoice', 'INV-CREDIT-LINK-A', 0,
    'Onions', 'onions', 2, 'lb',
    3, 6, 'USD', '2026-11-26',
    gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
    'c1111111-1111-4111-8111-11111111111c'
  ),
  (
    'c0000000-0000-4000-8000-0000000000a2',
    'c0000000-0000-4000-8000-00000000000c',
    'c0000000-0000-4000-8000-000000000092',
    'invoice', 'INV-CREDIT-LINK-B', 0,
    'Onions', 'onions', 2, 'lb',
    3, 6, 'USD', '2026-11-26',
    gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
    'c1111111-1111-4111-8111-11111111111c'
  ),
  (
    'c0000000-0000-4000-8000-0000000000c1',
    'c0000000-0000-4000-8000-00000000000c',
    'c0000000-0000-4000-8000-000000000091',
    'credit_memo', 'CM-CREDIT-LINK-SEED', 0,
    'Onions', 'onions', 1, 'lb',
    3, 3, 'USD', '2026-11-26',
    gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
    'c1111111-1111-4111-8111-11111111111c'
  );

select has_function(
  'private',
  'enforce_purchase_line_credit_link_target_evidence',
  'credit link target evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags,
      credits_line_id, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'credit_memo', 'CM-CREDIT-LINK-FORGE-CREDIT', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c0000000-0000-4000-8000-0000000000c1',
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  'Credits may only reference purchase lines',
  'direct insert rejects credits_line_id pointing at another credit'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags,
      credits_line_id, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'credit_memo', 'CM-CREDIT-LINK-FORGE-SUPPLIER', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c0000000-0000-4000-8000-0000000000a2',
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  'Credited purchase line is not available for this supplier',
  'direct insert rejects credits_line_id pointing at another supplier purchase'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      id, restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags,
      credits_line_id, recorded_by
    ) values (
      'c0000000-0000-4000-8000-0000000000c2',
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'credit_memo', 'CM-CREDIT-LINK-OK-DIRECT', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c0000000-0000-4000-8000-0000000000a1',
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  null,
  'direct insert accepts credits_line_id naming a same-supplier purchase'
);

select is(
  (select credits_line_id from public.purchase_lines
    where id = 'c0000000-0000-4000-8000-0000000000c2'),
  'c0000000-0000-4000-8000-0000000000a1'::uuid,
  'accepted direct credit stores the purchase credits_line_id exactly'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000c',
      'c0000000-0000-4000-8000-000000000091',
      'credit_memo', 'CM-CREDIT-LINK-UNLINKED', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c1111111-1111-4111-8111-11111111111c'
    )
  $sql$),
  null,
  'direct insert still allows an unlinked credit'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-11111111111c', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000c',
      'credit_memo',
      'CM-CREDIT-LINK-RPC-FORGE-CREDIT',
      $json$[
        {"lineIndex":0,"lineType":"credit","rawItemDescription":"Onions",
         "quantity":1,"unitOfMeasure":"lb","unitPrice":3,"extendedPrice":3,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed",
         "creditsLineId":"c0000000-0000-4000-8000-0000000000c1"}
      ]$json$::jsonb,
      'c0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  'Credits may only reference purchase lines',
  'RPC rejects creditsLineId pointing at another credit under the same supplier'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000c',
      'credit_memo',
      'CM-CREDIT-LINK-RPC-OK',
      $json$[
        {"lineIndex":0,"lineType":"credit","rawItemDescription":"Onions",
         "quantity":1,"unitOfMeasure":"lb","unitPrice":3,"extendedPrice":3,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed",
         "creditsLineId":"c0000000-0000-4000-8000-0000000000a1"}
      ]$json$::jsonb,
      'c0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  null,
  'RPC accepts creditsLineId naming a same-supplier purchase'
);

select is(
  (select credits_line_id from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and source_document_reference = 'CM-CREDIT-LINK-RPC-OK'),
  'c0000000-0000-4000-8000-0000000000a1'::uuid,
  'accepted RPC credit stores the purchase credits_line_id exactly'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000c',
      'credit_memo',
      'CM-CREDIT-LINK-RPC-UNLINKED',
      $json$[
        {"lineIndex":0,"lineType":"credit","rawItemDescription":"Onions",
         "quantity":1,"unitOfMeasure":"lb","unitPrice":3,"extendedPrice":3,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed"}
      ]$json$::jsonb,
      'c0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  null,
  'RPC still allows an unlinked credit'
);

reset role;

select is(
  (
    select count(*) from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000c'
      and source_document_reference = 'CM-CREDIT-LINK-RPC-UNLINKED'
      and credits_line_id is null
      and line_type = 'credit'
  ),
  1::bigint,
  'accepted unlinked RPC credit remains credit with null credits_line_id'
);

select * from finish();
rollback;
