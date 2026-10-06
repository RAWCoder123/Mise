-- MISE-005IR: outreach_leads.source_url CHECK must keep the https?://
-- protocol prefix, pin length 1..2048, and reject control characters under
-- COLLATE "C" so dump/restore cannot accept source_url bytes sibling
-- C-locale URL gates would refuse (and vice versa).
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'outreach_leads_source_url_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'length\(source_url\) between 1 and 2048',
  'source_url CHECK pins length 1–2048 bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'source_url collate "C" !~ ''[[:cntrl:]]''',
  'source_url CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'source_url collate "C" ~\* ''\^https\?://''',
  'source_url CHECK keeps https?:// protocol under COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('https://example.com/listing' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable HTTPS source_url is not a control under COLLATE C'
);

select is(
  ('http://example.com/listing' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable HTTP source_url is not a control under COLLATE C'
);

select is(
  (E'https://example.com/\tlisting' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab in source_url is a control under COLLATE C'
);

select is(
  (E'https://example.com/\nlisting' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII newline in source_url is a control under COLLATE C'
);

select is(
  (E'https://example.com/\u007flisting' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL in source_url is a control under COLLATE C'
);

select is(
  (
    select count(*)
    from (values
      (E'https://example.com/\tlisting'),
      ('https://example.com/listing'),
      (E'https://example.com/\nlisting'),
      (E'https://example.com/\u007flisting')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
