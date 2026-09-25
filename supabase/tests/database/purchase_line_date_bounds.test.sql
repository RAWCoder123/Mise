create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|throws_ok)\(' purchase_line_date_bounds.test.sql
-- This file has no loops or conditional assertion paths.
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
  ('6a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'date-bounds-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('6a000000-0000-4000-8000-000000000001', 'Date Bounds Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('6a000000-0000-4000-8000-000000000001', '6a111111-1111-4111-8111-111111111111', 'manager', 'active');
insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('6a000000-0000-4000-8000-000000000101', '6a000000-0000-4000-8000-000000000001', 'Date Bounds Produce', 'date bounds produce');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);

select is(
  pg_temp.error_of(format(
    $sql$select public.ingest_purchase_lines(
      '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-FUTURE',
      '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Future Chicken",
         "transactionDate":%L,"parseConfidence":"estimated"}]'::jsonb,
      '6a000000-0000-4000-8000-000000000101'
    )$sql$,
    (current_date + 2)::text
  )),
  'Purchase line transaction_date is in the future',
  'ingest rejects a transaction_date more than one day ahead of current_date'
);

select is(
  pg_temp.error_of(format(
    $sql$select public.ingest_purchase_lines(
      '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-ANCIENT',
      '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Ancient Chicken",
         "transactionDate":%L,"parseConfidence":"estimated"}]'::jsonb,
      '6a000000-0000-4000-8000-000000000101'
    )$sql$,
    (current_date - 91)::text
  )),
  'Purchase line transaction_date is older than the allowed lookback window',
  'ingest rejects a transaction_date older than the 90-day lookback'
);

select is(
  pg_temp.error_of(format(
    $sql$select public.ingest_purchase_lines(
      '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-RECV-FUTURE',
      '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Recv Future",
         "transactionDate":%L,"receivedDate":%L,"parseConfidence":"estimated"}]'::jsonb,
      '6a000000-0000-4000-8000-000000000101'
    )$sql$,
    current_date::text,
    (current_date + 2)::text
  )),
  'Purchase line received_date is in the future',
  'ingest rejects a received_date more than one day ahead of current_date'
);

select is(
  pg_temp.error_of(format(
    $sql$select public.ingest_purchase_lines(
      '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-RECV-ANCIENT',
      '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Recv Ancient",
         "transactionDate":%L,"receivedDate":%L,"parseConfidence":"estimated"}]'::jsonb,
      '6a000000-0000-4000-8000-000000000101'
    )$sql$,
    current_date::text,
    (current_date - 91)::text
  )),
  'Purchase line received_date is older than the allowed lookback window',
  'ingest rejects a received_date older than the 90-day lookback'
);

select is(
  (public.ingest_purchase_lines(
    '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-TODAY',
    jsonb_build_array(
      jsonb_build_object(
        'lineIndex', 0,
        'lineType', 'purchase',
        'rawItemDescription', 'Today Chicken',
        'transactionDate', current_date::text,
        'parseConfidence', 'estimated'
      )
    ),
    '6a000000-0000-4000-8000-000000000101'
  ))->>'recordedLineCount',
  '1',
  'ingest accepts a transaction_date of current_date'
);

select is(
  (public.ingest_purchase_lines(
    '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-SKEW',
    jsonb_build_array(
      jsonb_build_object(
        'lineIndex', 0,
        'lineType', 'purchase',
        'rawItemDescription', 'Skew Chicken',
        'transactionDate', (current_date + 1)::text,
        'parseConfidence', 'estimated'
      )
    ),
    '6a000000-0000-4000-8000-000000000101'
  ))->>'recordedLineCount',
  '1',
  'ingest accepts a one-day future skew for timezone edges'
);

select is(
  (public.ingest_purchase_lines(
    '6a000000-0000-4000-8000-000000000001', 'invoice', 'INV-LOOKBACK',
    jsonb_build_array(
      jsonb_build_object(
        'lineIndex', 0,
        'lineType', 'purchase',
        'rawItemDescription', 'Lookback Chicken',
        'transactionDate', (current_date - 90)::text,
        'receivedDate', current_date::text,
        'parseConfidence', 'estimated'
      )
    ),
    '6a000000-0000-4000-8000-000000000101'
  ))->>'recordedLineCount',
  '1',
  'ingest accepts the exact 90-day lookback boundary'
);

select is(
  (select count(*) from public.purchase_lines
    where restaurant_id = '6a000000-0000-4000-8000-000000000001'),
  3::bigint,
  'only the three in-window ingestions were recorded'
);

select * from finish();
rollback;
