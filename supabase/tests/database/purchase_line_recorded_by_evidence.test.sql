create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' purchase_line_recorded_by_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

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
  ('e1111111-1111-4111-8111-11111111111e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'recorded-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-00000000000e', 'Recorded By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-00000000000e', 'e1111111-1111-4111-8111-11111111111e', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000091', 'e0000000-0000-4000-8000-00000000000e', 'Evidence Produce', 'evidence produce');

select has_function(
  'private',
  'enforce_purchase_line_recorded_by_evidence',
  'recorded_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, raw_item_description, normalized_item_key, quantity,
      unit_of_measure, unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000091',
      'invoice', 'INV-RECORDED-BY-NULL', 0,
      0, 'Onions', 'onions', 10, 'lb',
      2, 20, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      null
    )
  $sql$),
  'Purchase line recorder is required',
  'direct purchase_lines insert cannot mint an unattributable null recorded_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.purchase_lines (
      restaurant_id, supplier_id, source, source_document_reference, line_index,
      revision, raw_item_description, normalized_item_key, quantity,
      unit_of_measure, unit_price, extended_price, currency, transaction_date,
      correlation_id, parse_confidence, line_type, consistency_flags, recorded_by
    ) values (
      'e0000000-0000-4000-8000-00000000000e',
      'e0000000-0000-4000-8000-000000000091',
      'invoice', 'INV-RECORDED-BY-DIRECT-OK', 0,
      0, 'Onions', 'onions', 10, 'lb',
      2, 20, 'USD', '2026-11-26',
      gen_random_uuid(), 'confirmed', 'purchase', array[]::text[],
      'e1111111-1111-4111-8111-11111111111e'
    )
  $sql$),
  null,
  'direct purchase_lines insert with a real recorded_by remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-11111111111e', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.ingest_purchase_lines(
      'e0000000-0000-4000-8000-00000000000e',
      'invoice',
      'INV-RECORDED-BY-RPC-OK',
      $json$[
        {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Carrots",
         "quantity":5,"unitOfMeasure":"lb","unitPrice":1,"extendedPrice":5,
         "currency":"USD","transactionDate":"2026-11-26","parseConfidence":"confirmed"}
      ]$json$::jsonb,
      'e0000000-0000-4000-8000-000000000091'
    )
  $sql$),
  null,
  'manager JWT can ingest a purchase line with auth.uid() recorded_by attribution'
);

select is(
  (select recorded_by from public.purchase_lines
    where restaurant_id = 'e0000000-0000-4000-8000-00000000000e'
      and source_document_reference = 'INV-RECORDED-BY-RPC-OK'),
  'e1111111-1111-4111-8111-11111111111e'::uuid,
  'accepted RPC purchase line keeps the authenticated recorded_by'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'e1111111-1111-4111-8111-11111111111e'
  $sql$),
  null,
  'account deletion remains allowed after purchase-line history exists'
);

select is(
  (
    select count(*)
    from public.purchase_lines
    where source_document_reference = 'INV-RECORDED-BY-RPC-OK'
      and recorded_by is null
  ),
  1::bigint,
  'account deletion anonymizes recorded_by without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.purchase_lines
    where source_document_reference = 'INV-RECORDED-BY-RPC-OK'
      and quantity = 5
      and raw_item_description = 'Carrots'
      and line_type = 'purchase'
  ),
  1::bigint,
  'account deletion preserves immutable purchase-line business fields'
);

select * from finish();
rollback;
