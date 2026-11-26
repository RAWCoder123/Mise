create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_credit_memo_line_type_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111d', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'credit-memo-line-type-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000d', 'Credit Memo Line Type Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000d', 'c1111111-1111-4111-8111-11111111111d', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000093', 'c0000000-0000-4000-8000-00000000000d', 'Evidence Co', 'evidence co');

select has_function(
  'private',
  'enforce_purchase_line_credit_memo_line_type_evidence',
  'credit memo line type evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000093',
      'credit_memo', 'CM-LINE-TYPE-FORGE-PURCHASE', 0,
      'Onions', 'onions', 2, 'lb',
      3, 6, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  'Credit memo documents may only contain credit lines',
  'direct insert rejects credit_memo with line_type = purchase'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      id, restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'c0000000-0000-4000-8000-0000000000d1',
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000093',
      'credit_memo', 'CM-LINE-TYPE-OK-DIRECT', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct insert accepts credit_memo with line_type = credit'
);

select is(
  (select line_type from public.purchase_lines
    where id = 'c0000000-0000-4000-8000-0000000000d1'),
  'credit',
  'accepted credit_memo stores line_type = credit exactly'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000093',
      'invoice', 'INV-LINE-TYPE-CREDIT-OK', 0,
      'Onions', 'onions', 1, 'lb',
      3, 3, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'credit', array[]::text[],
      'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct insert still allows invoice documents to carry credit lines'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      raw_item_description, normalized_item_key, quantity, unit_of_measure,
      unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'c0000000-0000-4000-8000-00000000000d',
      'c0000000-0000-4000-8000-000000000093',
      'invoice', 'INV-LINE-TYPE-PURCHASE-OK', 0,
      'Onions', 'onions', 2, 'lb',
      3, 6, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      'c1111111-1111-4111-8111-11111111111d'
    )
  $sql$),
  null,
  'direct insert still allows invoice purchases'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-11111111111d', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000d',
      'credit_memo',
      'CM-LINE-TYPE-RPC-FORGE',
      '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Onions","quantity":2,
        "unitOfMeasure":"lb","unitPrice":3,"extendedPrice":6,"currency":"USD",
        "transactionDate":"2026-11-26","parseConfidence":"confirmed"}]'::jsonb,
      'c0000000-0000-4000-8000-000000000093'
    )
  $sql$),
  'Credit memo documents may only contain credit lines',
  'RPC rejects credit_memo ingestion with a purchase line'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000d',
      'credit_memo',
      'CM-LINE-TYPE-RPC-OK',
      '[{"lineIndex":0,"lineType":"credit","rawItemDescription":"Onions","quantity":1,
        "unitOfMeasure":"lb","unitPrice":3,"extendedPrice":3,"currency":"USD",
        "transactionDate":"2026-11-26","parseConfidence":"confirmed"}]'::jsonb,
      'c0000000-0000-4000-8000-000000000093'
    )
  $sql$),
  null,
  'RPC accepts credit_memo ingestion with a credit line'
);

select is(
  (
    select line_type
    from public.purchase_lines
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000d'
      and source_document_reference = 'CM-LINE-TYPE-RPC-OK'
      and revision = 0
    limit 1
  ),
  'credit',
  'accepted RPC credit_memo stores line_type = credit exactly'
);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'c0000000-0000-4000-8000-00000000000d',
      'invoice',
      'INV-LINE-TYPE-RPC-CREDIT-OK',
      '[{"lineIndex":0,"lineType":"credit","rawItemDescription":"Onions","quantity":1,
        "unitOfMeasure":"lb","unitPrice":3,"extendedPrice":3,"currency":"USD",
        "transactionDate":"2026-11-26","parseConfidence":"confirmed"}]'::jsonb,
      'c0000000-0000-4000-8000-000000000093'
    )
  $sql$),
  null,
  'RPC still allows invoice documents to carry credit lines'
);

reset role;

select * from finish();
rollback;
