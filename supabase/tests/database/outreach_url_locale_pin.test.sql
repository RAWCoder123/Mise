-- MISE-005AI: outreach HTTP(S) URL prefix CHECKs must be pinned to COLLATE "C"
-- so restore cannot reject campaign/lead rows the source accepted when
-- LC_CTYPE drifts under bare ~* case folding.
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

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'outreach_leads_source_url_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_lead_website_url'
  ),
  'outreach_lead_website_url exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaign_cta_url'
  ),
  'cta_url collate "C" ~\* ''\^https\?://''',
  'cta_url CHECK uses COLLATE C ~* https?:// prefix'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_source_url_check'
  ),
  'source_url collate "C" ~\* ''\^https\?://''',
  'source_url CHECK uses COLLATE C ~* https?:// prefix'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_lead_website_url'
  ),
  'website collate "C" ~\* ''\^https\?://''',
  'website CHECK uses COLLATE C ~* https?:// prefix'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII case fold.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('https://mise.example/demo' collate "C" ~* '^https?://'),
  true,
  'https URL matches under COLLATE C'
);

select is(
  ('HTTP://mise.example/demo' collate "C" ~* '^https?://'),
  true,
  'uppercase HTTP URL matches under COLLATE C ~*'
);

select is(
  ('ftp://mise.example/demo' collate "C" ~* '^https?://'),
  false,
  'ftp URL fails under COLLATE C'
);

select is(
  ('not-a-url' collate "C" ~* '^https?://'),
  false,
  'bare text fails under COLLATE C'
);

select * from finish();
rollback;
