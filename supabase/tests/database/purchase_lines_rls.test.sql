create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -c '^select is(\|^select isnt(' purchase_lines_rls.test.sql
-- This file has no loops or conditional assertion paths, so call sites and
-- executions are the same number. If pgTAP reports a different count, that is a
-- failure to investigate, not a number to edit.
select plan(65);

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
  ('5a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ledger-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('5a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ledger-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('5b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ledger-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('5a333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ledger-departing@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('5a000000-0000-4000-8000-000000000001', 'Ledger Kitchen', 'Cafe', 'UTC'),
  ('5b000000-0000-4000-8000-000000000001', 'Other Ledger Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('5a000000-0000-4000-8000-000000000001', '5a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('5a000000-0000-4000-8000-000000000001', '5a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('5a000000-0000-4000-8000-000000000001', '5a333333-3333-4333-8333-333333333333', 'manager', 'active'),
  ('5b000000-0000-4000-8000-000000000001', '5b111111-1111-4111-8111-111111111111', 'owner', 'active');
insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('5a000000-0000-4000-8000-000000000101', '5a000000-0000-4000-8000-000000000001', 'Metro Produce', 'metro produce'),
  ('5b000000-0000-4000-8000-000000000101', '5b000000-0000-4000-8000-000000000001', 'Other Produce', 'other produce');

-- ------------------------------------------------------------- normalization
select is(
  private.normalize_purchase_item_key('CHICKEN THIGHS, BONELESS - 40 LB CASE'),
  'chicken thighs boneless case',
  'case, punctuation, and pack are normalized out of the item key'
);
select is(
  private.normalize_purchase_item_key('  chicken   thighs   boneless  40lb  case '),
  'chicken thighs boneless case',
  'spacing variants collapse to the same deterministic key'
);
select is(
  private.extract_purchase_pack_size('Olive Oil X-Virgin 6/1GAL'), '6x1gal',
  'count/size packs render canonically'
);
select is(
  private.extract_purchase_pack_size('Olive Oil, X-Virgin, 6 x 1 GAL'), '6x1gal',
  'the same pack spelled with spaces renders identically'
);
select is(
  private.extract_purchase_pack_size('Sugar 1.00 KG'), '1kg',
  'pack rendering does not vary with trailing zeros'
);
select is(
  private.extract_purchase_pack_size('2% Milk'), null::text,
  'a bare number next to no known unit is not a pack size'
);
select is(
  private.normalize_purchase_item_key('###'), null::text,
  'a description with nothing alphanumeric yields no key'
);
select isnt(
  private.normalize_purchase_item_key('Chicken Thigh 40lb'),
  private.normalize_purchase_item_key('Chicken Thighs 40lb'),
  'ambiguity is preserved: no stemming or fuzzy matching'
);

-- ---------------------------------------- MISE-005A locale independence
-- The key feeds a CHECK constraint on an append-only table, so if LC_CTYPE
-- ever changed the recomputed value, a restore would abort on rows that could
-- not then be repaired in place. Accents are folded first and every case
-- change and class test is pinned to COLLATE "C", so the result cannot move.
-- Compared as bytea because a text result inherits its argument's collation.
select is(
  (select count(*) from (values
     ('JALAPENO PEPPERS 10 LB'), ('creme fraiche 6/1GAL'), ('Weissbier 24/500ml'),
     ('Gruyere AOP 2.5kg'), ('Aebleskiver 12 ct'), ('MULLER 40LB CASE'),
     ('Lukasz 6 x 1 gal'), ('cafe blend'), ('###'), ('  mixed   CASE  40lb ')
   ) fixture(sample)
   where convert_to(private.normalize_purchase_item_key(fixture.sample collate "C"), 'UTF8')
     is distinct from
     convert_to(private.normalize_purchase_item_key(fixture.sample collate "en_US.utf8"), 'UTF8')),
  0::bigint,
  'the item key is byte-identical under C and under the database ctype'
);
select is(
  (select count(*) from (values
     ('JALAPEÑO PEPPERS 10 LB'), ('crème fraîche 6/1GAL'), ('Weißbier 24/500ml'),
     ('Gruyère AOP 2.5kg'), ('Æbleskiver 12 ct'), ('MÜLLER 40LB CASE'),
     ('Łukasz 6 x 1 gal'), ('café blend'), ('豚バラ肉 5kg')
   ) fixture(sample)
   where convert_to(private.normalize_purchase_item_key(fixture.sample collate "C"), 'UTF8')
     is distinct from
     convert_to(private.normalize_purchase_item_key(fixture.sample collate "en_US.utf8"), 'UTF8')),
  0::bigint,
  'accented and non-Latin input is byte-identical under both ctypes too'
);
select is(
  private.normalize_purchase_item_key('JALAPEÑO PEPPERS'),
  private.normalize_purchase_item_key('jalapeño peppers'),
  'case and accent agree on one key, which is what netting depends on'
);
select is(
  private.normalize_purchase_item_key('JALAPEÑO PEPPERS'),
  'jalapeno peppers',
  'the agreed key is the plain ASCII fold'
);
select is(
  (select count(*) from (values
     ('Jalapeño Peppers 10 LB'), ('CRÈME FRAÎCHE'), ('Gruyère AOP 2.5kg'),
     ('Müller-Thurgau'), ('Æbleskiver mix'), ('Weißbier 24/500ml'),
     ('Łukasz Pierogi 5lb'), ('café blend')
   ) fixture(sample)
   where private.normalize_purchase_item_key(fixture.sample) !~ '^[a-z0-9 ]+$'),
  0::bigint,
  'the key is always plain ASCII, whatever the description contained'
);
select is(
  (select private.normalize_purchase_item_key('Weißbier') || '|'
       || private.normalize_purchase_item_key('Æbleskiver') || '|'
       || private.normalize_purchase_item_key('Œuf')),
  'weissbier|aebleskiver|oeuf',
  'characters that widen are expanded, not dropped'
);
select is(
  private.normalize_purchase_item_key('豚バラ肉 5kg'),
  null::text,
  'an unmapped non-ASCII character is a separator everywhere, never a letter'
);

-- ---------------------------------------------------------------- ingestion
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);

select is(
  (public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-4471',
    $json$[
      {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Chicken Thighs Boneless 40 LB Case","quantity":2,
       "unitOfMeasure":"case","unitPrice":86.5,"extendedPrice":173,"currency":"USD",
       "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
      {"lineIndex":1,"lineType":"purchase","rawItemDescription":"Olive Oil X-Virgin 6/1GAL","quantity":1,
       "unitOfMeasure":"case","unitPrice":121.4,"extendedPrice":121.4,"currency":"USD",
       "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
      {"lineIndex":2,"lineType":"purchase","rawItemDescription":"Napa Cabbage - 50 ct","quantity":1,
       "unitOfMeasure":"case","transactionDate":"2026-09-01","parseConfidence":"confirmed"}
    ]$json$::jsonb,
    '5a000000-0000-4000-8000-000000000101'
  ))->>'recordedLineCount',
  '3',
  'a three-line invoice records three lines'
);
select is(
  (public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-4471',
    $json$[
      {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Chicken Thighs Boneless 40 LB Case","quantity":2,
       "unitOfMeasure":"case","unitPrice":86.5,"extendedPrice":173,"currency":"USD",
       "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
      {"lineIndex":1,"lineType":"purchase","rawItemDescription":"Olive Oil X-Virgin 6/1GAL","quantity":1,
       "unitOfMeasure":"case","unitPrice":121.4,"extendedPrice":121.4,"currency":"USD",
       "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
      {"lineIndex":2,"lineType":"purchase","rawItemDescription":"Napa Cabbage - 50 ct","quantity":1,
       "unitOfMeasure":"case","transactionDate":"2026-09-01","parseConfidence":"confirmed"}
    ]$json$::jsonb,
    '5a000000-0000-4000-8000-000000000101'
  ))->>'duplicateLineCount',
  '3',
  're-ingesting the same document records nothing new'
);
select is(
  (select count(*) from public.purchase_lines
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and source_document_reference = 'INV-4471'),
  3::bigint,
  'idempotent re-ingestion leaves exactly one row per document line'
);

-- Partial parse stays visible and is never defaulted.
select is(
  (select parse_confidence from public.purchase_lines
   where source_document_reference = 'INV-4471' and line_index = 2),
  'could_not_verify',
  'a line missing its price cannot claim to be confirmed'
);
select is(
  (select unit_price is null and extended_price is null and currency is null
   from public.purchase_lines where source_document_reference = 'INV-4471' and line_index = 2),
  true,
  'absent parsed fields stay null rather than defaulting to zero'
);
select is(
  (select normalized_item_key || ' | ' || pack_size from public.purchase_lines
   where source_document_reference = 'INV-4471' and line_index = 1),
  'olive oil x virgin | 6x1gal',
  'the server computes the normalized key and pack size'
);

-- Every ingestion emits a truthful activity record.
select is(
  (select summary from public.activity_events
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and event_type = 'purchase_lines_recorded'
     and trigger_type = 'purchase_line_ingestion'
   order by occurred_at limit 1),
  'Recorded 3 of 3 lines from INV-4471. 0 already on file. 2 confirmed, 0 estimated, 1 could not be verified.',
  'the activity record states what was recorded and what could not be verified'
);
select is(
  (select requires_attention from public.activity_events
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and event_type = 'purchase_lines_recorded'
   order by occurred_at limit 1),
  true,
  'an unverifiable line raises attention rather than passing silently'
);

-- Malformed submissions fail loudly instead of collapsing.
select is(
  pg_temp.error_of($sql$select public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-DUP',
    '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"A","transactionDate":"2026-09-01","parseConfidence":"estimated"},
      {"lineIndex":0,"lineType":"purchase","rawItemDescription":"B","transactionDate":"2026-09-01","parseConfidence":"estimated"}]'::jsonb
  )$sql$),
  'Purchase line position 0 was submitted twice',
  'a duplicated document position is refused, never silently dropped'
);
select is(
  pg_temp.error_of($sql$select public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-FOREIGN',
    '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"X","transactionDate":"2026-09-01","parseConfidence":"estimated"}]'::jsonb,
    '5b000000-0000-4000-8000-000000000101'
  )$sql$),
  'Supplier identity is not available for this restaurant',
  'durable supplier identity may not cross a tenant boundary'
);

-- -------------------------------------------------------------- corrections
select is(
  (select (correction.revision::text || '|' || (correction.supersedes_line_id = original.id)::text
    || '|' || correction.quantity::text)
   from public.purchase_lines original
   cross join lateral (
     select * from public.supersede_purchase_line(
       '5a000000-0000-4000-8000-000000000001', original.id,
       '{"lineType":"purchase","rawItemDescription":"Napa Cabbage - 50 ct","quantity":2,"unitOfMeasure":"case",
         "unitPrice":31.25,"extendedPrice":62.5,"currency":"USD",
         "transactionDate":"2026-09-01","parseConfidence":"confirmed"}'::jsonb)
   ) correction
   where original.source_document_reference = 'INV-4471'
     and original.line_index = 2 and original.revision = 0),
  '1|true|2',
  'a correction appends a new line that references the line it supersedes'
);
select is(
  (select quantity::text || '|' || parse_confidence from public.purchase_lines
   where source_document_reference = 'INV-4471' and line_index = 2 and revision = 0),
  '1|could_not_verify',
  'the corrected line is left exactly as it was recorded'
);
select is(
  pg_temp.error_of(format($sql$select public.supersede_purchase_line(
    '5a000000-0000-4000-8000-000000000001', '%s',
    '{"lineType":"purchase","rawItemDescription":"Napa Cabbage - 50 ct","transactionDate":"2026-09-01",
      "parseConfidence":"estimated"}'::jsonb)$sql$,
    (select id from public.purchase_lines
     where source_document_reference = 'INV-4471' and line_index = 2 and revision = 0))),
  'Purchase line has already been corrected',
  'a correction chain stays linear'
);

-- ---------------------------------------------------------------- authority
select is(
  pg_temp.error_of($sql$select set_config('request.jwt.claim.sub','5a222222-2222-4222-8222-222222222222',true);
    select public.ingest_purchase_lines('5a000000-0000-4000-8000-000000000001','invoice','INV-STAFF',
    '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"X","transactionDate":"2026-09-01","parseConfidence":"estimated"}]'::jsonb)$sql$),
  'Manager access required',
  'staff may not write purchase history'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '5b111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.error_of($sql$select public.ingest_purchase_lines('5a000000-0000-4000-8000-000000000001','invoice','INV-X',
    '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"X","transactionDate":"2026-09-01","parseConfidence":"estimated"}]'::jsonb)$sql$),
  'Manager access required',
  'another tenant may not write into this restaurant'
);
select is(
  (select count(*) from public.purchase_lines), 0::bigint,
  'another tenant reads no purchase lines at all'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select is(
  (select count(*) from public.purchase_lines), 4::bigint,
  'a member reads only its own restaurant history'
);

-- The Data API grants SELECT and nothing else. A typo would surface as a
-- different message than the privilege refusal these assertions are about.
select is(
  pg_temp.error_of($sql$insert into public.purchase_lines
    (restaurant_id, source, source_document_reference, line_index, raw_item_description,
     normalized_item_key, transaction_date, correlation_id, parse_confidence, line_type)
    values ('5a000000-0000-4000-8000-000000000001','invoice','INV-CLIENT',0,'X','x',
            '2026-09-01', gen_random_uuid(), 'estimated','purchase')$sql$),
  'permission denied for table purchase_lines',
  'a client insert is refused on privilege, not on some other error'
);
select is(
  pg_temp.error_of($sql$update public.purchase_lines set quantity = 99$sql$),
  'permission denied for table purchase_lines',
  'a client update is refused on privilege, not on some other error'
);
select is(
  pg_temp.error_of($sql$delete from public.purchase_lines$sql$),
  'permission denied for table purchase_lines',
  'a client delete is refused on privilege, not on some other error'
);
reset role;

-- Append-only holds even for a privileged writer.
select is(
  pg_temp.error_of($sql$update public.purchase_lines set quantity = 99
    where source_document_reference = 'INV-4471'$sql$),
  'Purchase lines are append-only',
  'historical purchase lines are never mutated'
);
select is(
  pg_temp.error_of($sql$delete from public.purchase_lines
    where source_document_reference = 'INV-4471'$sql$),
  'Purchase lines are append-only',
  'historical purchase lines are never deleted'
);

-- ------------------------------------------- internal-consistency confidence
-- A line that contradicts itself is stored exactly as the document stated it.
-- Only its confidence is capped, and the cap is server-side.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select public.ingest_purchase_lines(
  '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-CONSIST',
  $json$[
    {"lineIndex":0,"lineType":"purchase","rawItemDescription":"Chicken Thighs Boneless 40 LB Case","quantity":2,
     "unitOfMeasure":"case","unitPrice":86.5,"extendedPrice":1730,"currency":"USD",
     "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
    {"lineIndex":1,"lineType":"purchase","rawItemDescription":"Olive Oil X-Virgin 6/1GAL","quantity":1,
     "unitOfMeasure":"lb","unitPrice":121.4,"extendedPrice":121.4,"currency":"USD",
     "transactionDate":"2026-09-01","parseConfidence":"confirmed"},
    {"lineIndex":2,"lineType":"purchase","rawItemDescription":"Napa Cabbage - 50 ct","quantity":1,
     "unitOfMeasure":"case","unitPrice":31.25,"extendedPrice":31.25,"currency":"USD",
     "transactionDate":"2026-09-05","receivedDate":"2026-09-01","parseConfidence":"confirmed"},
    {"lineIndex":3,"lineType":"purchase","rawItemDescription":"Olive Oil X-Virgin 6/1GAL","packSize":"12/1 GAL",
     "quantity":1,"unitOfMeasure":"case","unitPrice":121.4,"extendedPrice":121.4,
     "currency":"USD","transactionDate":"2026-09-01","parseConfidence":"confirmed"},
    {"lineIndex":4,"lineType":"purchase","rawItemDescription":"Tomatoes, Roma 25LB","quantity":30,
     "unitOfMeasure":"lb","unitPrice":1.33,"extendedPrice":39.99,"currency":"USD",
     "transactionDate":"2026-09-01","parseConfidence":"confirmed"}
  ]$json$::jsonb
);
reset role;

select is(
  (select parse_confidence || '|' || pg_catalog.array_to_string(consistency_flags, ',')
   from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 0),
  'could_not_verify|extended_price_mismatch',
  'an extended price that contradicts quantity times unit price cannot be confirmed'
);
select is(
  (select extended_price::text from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 0),
  '1730',
  'the contradicting number is stored exactly as stated, never corrected'
);
select is(
  (select parse_confidence || '|' || pg_catalog.array_to_string(consistency_flags, ',')
   from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 1),
  'could_not_verify|pack_unit_dimension_conflict',
  'a pack in gallons under a unit of measure in pounds cannot be confirmed'
);
select is(
  (select parse_confidence || '|' || pg_catalog.array_to_string(consistency_flags, ',')
   from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 2),
  'estimated|received_before_transaction',
  'a receipt dated before the transaction drops to estimated, not unverified'
);
select is(
  (select parse_confidence || '|' || pg_catalog.array_to_string(consistency_flags, ',')
   from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 3),
  'estimated|pack_size_conflicts_description',
  'a stated pack size the description does not support drops to estimated'
);
select is(
  (select parse_confidence || '|' || pg_catalog.cardinality(consistency_flags)::text
   from public.purchase_lines
   where source_document_reference = 'INV-CONSIST' and line_index = 4),
  'confirmed|0',
  'ordinary invoice rounding stays inside the tolerance and stays confirmed'
);

-- The downgrade is named, not merely counted.
select is(
  (select summary from public.activity_events
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and event_type = 'purchase_line_confidence_downgraded'
   order by occurred_at limit 1),
  -- Clauses are ordered by flag name so the summary is stable across runs.
  '4 of 5 recorded lines from INV-CONSIST could not keep their stated confidence: '
    || '1 with an extended price that does not match quantity times unit price; '
    || '1 with a stated pack size the description does not support; '
    || '1 where the pack size and the unit of measure disagree; '
    || '1 received before the transaction date.',
  'the downgrade activity names every property that failed'
);
select is(
  (select requires_attention from public.activity_events
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and event_type = 'purchase_line_confidence_downgraded'
   order by occurred_at limit 1),
  true,
  'a downgrade asks for an operator rather than passing quietly'
);
select is(
  (select metadata -> 'lines' -> 0 ->> 'statedConfidence'
     || '->' || (metadata -> 'lines' -> 0 ->> 'recordedConfidence')
     || '@' || (metadata -> 'lines' -> 0 ->> 'lineIndex')
   from public.activity_events
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'
     and event_type = 'purchase_line_confidence_downgraded'
   order by occurred_at limit 1),
  'confirmed->could_not_verify@0',
  'the activity records what each line claimed and what it was recorded as'
);

-- The database refuses a confirmed line carrying a contradiction, whatever writes it.
select is(
  pg_temp.error_of($sql$insert into public.purchase_lines
    (restaurant_id, source, source_document_reference, line_index, raw_item_description,
     normalized_item_key, quantity, unit_of_measure, unit_price, extended_price, currency,
     transaction_date, correlation_id, parse_confidence, consistency_flags, line_type)
    values ('5a000000-0000-4000-8000-000000000001','invoice','INV-FORCE',0,
            'Chicken Thighs Boneless 40 LB Case','chicken thighs boneless case',
            2,'case',86.5,1730,'USD','2026-09-01', gen_random_uuid(), 'confirmed',
            array['extended_price_mismatch']::text[], 'purchase')$sql$),
  'new row for relation "purchase_lines" violates check constraint "purchase_lines_consistency_confidence_check"',
  'a confirmed line carrying a contradiction cannot be written at all'
);

-- ---------------------------------------------------------- credits and nets
-- Direction must be stated. Nothing infers it.
select is(
  pg_temp.error_of($sql$select public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-NODIR',
    '[{"lineIndex":0,"rawItemDescription":"X","transactionDate":"2026-09-01",
       "parseConfidence":"estimated"}]'::jsonb
  )$sql$),
  'Purchase line 0 must state whether it is a purchase or a credit',
  'a line that does not state its direction is refused'
);

-- A credit memo is its own document, so it occupies its own idempotency space.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select public.ingest_purchase_lines(
  '5a000000-0000-4000-8000-000000000001', 'credit_memo', 'CM-8892',
  $json$[
    {"lineIndex":0,"lineType":"credit",
     "rawItemDescription":"Chicken Thighs Boneless 40 LB Case","quantity":1,
     "unitOfMeasure":"case","unitPrice":86.5,"extendedPrice":86.5,"currency":"USD",
     "transactionDate":"2026-09-03","parseConfidence":"confirmed"},
    {"lineIndex":1,"lineType":"credit","rawItemDescription":"Saffron Threads 2oz",
     "quantity":1,"unitOfMeasure":"each","unitPrice":41,"extendedPrice":41,
     "currency":"USD","transactionDate":"2026-09-03","parseConfidence":"confirmed"},
    {"lineIndex":2,"lineType":"credit",
     "rawItemDescription":"Olive Oil X-Virgin 6/1GAL","quantity":1,
     "unitOfMeasure":"case","unitPrice":121.4,"extendedPrice":1214,"currency":"USD",
     "transactionDate":"2026-09-03","parseConfidence":"confirmed"}
  ]$json$::jsonb,
  '5a000000-0000-4000-8000-000000000101'
);
reset role;

select is(
  (select line_type || '|' || parse_confidence || '|' || coalesce(credits_line_id::text, 'unlinked')
   from public.purchase_lines
   where source_document_reference = 'CM-8892' and line_index = 1),
  'credit|confirmed|unlinked',
  'a credit that matches no original line is recordable and fully confident'
);
select is(
  (select quantity::text || '|' || signed_quantity::text
     || '|' || extended_price::text || '|' || signed_extended_price::text
   from public.purchase_lines
   where source_document_reference = 'CM-8892' and line_index = 0),
  '1|-1|86.5|-86.5',
  'magnitudes stay positive and the signed projections carry the direction'
);
select is(
  (select parse_confidence || '|' || pg_catalog.array_to_string(consistency_flags, ',')
   from public.purchase_lines
   where source_document_reference = 'CM-8892' and line_index = 2),
  'could_not_verify|extended_price_mismatch',
  'a credit can be internally inconsistent and is checked exactly like a purchase'
);
select is(
  (select count(*) from public.purchase_lines
   where source_document_reference = 'INV-4471' and line_index = 0),
  1::bigint,
  'a credit memo never disturbs the invoice it offsets'
);

-- Netting is a plain aggregate over the signed projections.
select is(
  (select net_quantity::text || '|' || net_extended_price::text || '|' || unmatched_credit::text
   from public.list_purchase_line_net_by_item('5a000000-0000-4000-8000-000000000001')
   where normalized_item_key = 'chicken thighs boneless case'
     and supplier_id = '5a000000-0000-4000-8000-000000000101'),
  '1|86.5|false',
  'two purchased less one credited nets to one, by plain aggregate'
);
-- The same wording under a different supplier is a different group. Netting
-- across suppliers would be a larger claim than the documents support.
select is(
  (select count(*) from public.list_purchase_line_net_by_item(
     '5a000000-0000-4000-8000-000000000001')
   where normalized_item_key = 'chicken thighs boneless case'),
  2::bigint,
  'identical item wording under two suppliers never nets together'
);
select is(
  (select net_quantity::text || '|' || unmatched_credit::text
   from public.list_purchase_line_net_by_item('5a000000-0000-4000-8000-000000000001')
   where normalized_item_key = 'saffron threads'
     and supplier_id = '5a000000-0000-4000-8000-000000000101'),
  '-1|true',
  'a credit whose item key matches no purchase is flagged, never netted silently'
);

-- A stated link is validated, never inferred, and never required.
select is(
  pg_temp.error_of(format($sql$select public.ingest_purchase_lines(
    '5a000000-0000-4000-8000-000000000001', 'credit_memo', 'CM-CROSS',
    '[{"lineIndex":0,"lineType":"credit","rawItemDescription":"X",
       "transactionDate":"2026-09-03","parseConfidence":"estimated",
       "creditsLineId":"%s"}]'::jsonb
  )$sql$, (select id from public.purchase_lines
           where source_document_reference = 'INV-4471' and line_index = 0))),
  'Credited purchase line is not available for this supplier',
  'a credit link that does not resolve for this supplier fails closed'
);

-- Three generated columns now exist. The anonymization escape must still hold.
select is(
  (select count(*) from pg_catalog.pg_attribute attribute
   where attribute.attrelid = 'public.purchase_lines'::regclass
     and attribute.attnum > 0 and not attribute.attisdropped
     and attribute.attgenerated <> ''),
  3::bigint,
  'supplier_scope plus both signed projections are generated columns'
);

-- ------------------------------------- escape 1 of 2: actor anonymization
-- The append-only trigger permits exactly one UPDATE: setting recorded_by to
-- null, for an actor that no longer exists in auth.users, with every other
-- column byte-identical. This is the account-deletion path. Nothing else.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a333333-3333-4333-8333-333333333333', true);
select public.ingest_purchase_lines(
  '5a000000-0000-4000-8000-000000000001', 'invoice', 'INV-ANON',
  '[{"lineIndex":0,"lineType":"purchase","rawItemDescription":"Kosher Salt 3lb box","quantity":4,
     "unitOfMeasure":"box","unitPrice":5.25,"extendedPrice":21,"currency":"USD",
     "transactionDate":"2026-09-02","parseConfidence":"confirmed"}]'::jsonb
);
reset role;

select is(
  pg_temp.error_of($sql$update public.purchase_lines set recorded_by = null
    where source_document_reference = 'INV-ANON'$sql$),
  'Purchase lines are append-only',
  'the anonymization escape stays shut while the actor still exists'
);
select is(
  pg_temp.error_of($sql$update public.purchase_lines
    set recorded_by = null, quantity = 99
    where source_document_reference = 'INV-ANON'$sql$),
  'Purchase lines are append-only',
  'the anonymization escape does not carry any other column change with it'
);

delete from auth.users where id = '5a333333-3333-4333-8333-333333333333';

select is(
  (select recorded_by from public.purchase_lines
   where source_document_reference = 'INV-ANON'),
  null::uuid,
  'deleting the actor anonymizes the line through the sanctioned escape'
);
select is(
  (select raw_item_description || '|' || quantity::text || '|' || parse_confidence
     || '|' || extended_price::text
   from public.purchase_lines where source_document_reference = 'INV-ANON'),
  'Kosher Salt 3lb box|4|confirmed|21',
  'anonymization changes the actor and leaves the purchase evidence intact'
);
select is(
  pg_temp.error_of($sql$update public.purchase_lines set quantity = 99
    where source_document_reference = 'INV-ANON'$sql$),
  'Purchase lines are append-only',
  'the escape does not stay open once the line has been anonymized'
);

-- ---------------------------------------- escape 2 of 2: tenant cascade
-- The trigger permits DELETE only inside the transaction window marked by the
-- BEFORE DELETE statement trigger on public.restaurants, which sets
-- mise.inventory_event_tenant_delete. A client cannot reach that path at all,
-- because the Data API grants no DELETE on the table in the first place.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.error_of($sql$select set_config('mise.inventory_event_tenant_delete','true',true);
    delete from public.purchase_lines$sql$),
  'permission denied for table purchase_lines',
  'setting the cascade flag by hand does not give a client a delete path'
);
reset role;

select is(
  pg_temp.error_of($sql$delete from public.restaurants
    where id = '5a000000-0000-4000-8000-000000000001'$sql$),
  null::text,
  'deleting a restaurant cascades its purchase history away'
);
select is(
  (select count(*) from public.purchase_lines
   where restaurant_id = '5a000000-0000-4000-8000-000000000001'),
  0::bigint,
  'no purchase line survives its tenant'
);


select * from finish();
rollback;
