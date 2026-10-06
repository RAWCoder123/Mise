-- MISE-005IP: outreach_campaigns.cta_url CHECK must keep the https?://
-- protocol prefix, pin length 1..2048, and reject control characters under
-- COLLATE "C" so dump/restore cannot accept CTA URL bytes sibling C-locale
-- URL gates would refuse (and vice versa).
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaign_cta_url'
  ),
  'outreach_campaign_cta_url exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaign_cta_url'
  ),
  'length\(cta_url\) between 1 and 2048',
  'cta_url CHECK pins length 1–2048 bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaign_cta_url'
  ),
  'cta_url collate "C" !~ ''[[:cntrl:]]''',
  'cta_url CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaign_cta_url'
  ),
  'cta_url collate "C" ~\* ''\^https\?://''',
  'cta_url CHECK keeps https?:// protocol under COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('https://example.com/book' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable HTTPS CTA URL is not a control under COLLATE C'
);

select is(
  ('http://example.com/offer' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable HTTP CTA URL is not a control under COLLATE C'
);

select is(
  (E'https://example.com/\tpath' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab in CTA URL is a control under COLLATE C'
);

select is(
  (E'https://example.com/\npath' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII newline in CTA URL is a control under COLLATE C'
);

select is(
  (E'https://example.com/\u007fpath' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL in CTA URL is a control under COLLATE C'
);

select is(
  (
    select count(*)
    from (values
      (E'https://example.com/\tpath'),
      ('https://example.com/book'),
      (E'https://example.com/\npath'),
      (E'https://example.com/\u007fpath')
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
