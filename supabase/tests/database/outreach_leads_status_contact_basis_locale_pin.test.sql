-- MISE-005DR: outreach_leads.status and
-- outreach_leads.contact_basis CHECKs must keep the exact-token
-- allowlists and pin ASCII shape under COLLATE "C" so dump/restore
-- cannot accept a lead-status or contact-basis token the restored
-- C-locale gate would refuse.
begin;
select plan(28);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_status_check'
  ),
  'outreach_leads_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_status_check'
  ),
  'status in \(''new'', ''approved'', ''contacted'', ''replied'', ''interested'', ''not_interested'', ''unsubscribed'', ''bounced'', ''invalid''\)',
  'outreach_leads status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_leads status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_basis_check'
  ),
  'outreach_leads_contact_basis_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_basis_check'
  ),
  'contact_basis in \(''public_business_contact'', ''referral'', ''opt_in''\)',
  'outreach_leads contact_basis CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_basis_check'
  ),
  'contact_basis collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_leads contact_basis CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('new' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token new matches under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('contacted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token contacted matches under COLLATE C'
);

select is(
  ('replied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token replied matches under COLLATE C'
);

select is(
  ('interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token interested matches under COLLATE C'
);

select is(
  ('not_interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token not_interested matches under COLLATE C'
);

select is(
  ('unsubscribed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unsubscribed matches under COLLATE C'
);

select is(
  ('bounced' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token bounced matches under COLLATE C'
);

select is(
  ('invalid' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token invalid matches under COLLATE C'
);

select is(
  ('public_business_contact' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token public_business_contact matches under COLLATE C'
);

select is(
  ('referral' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token referral matches under COLLATE C'
);

select is(
  ('opt_in' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token opt_in matches under COLLATE C'
);

select is(
  ('not interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('public business contact' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced contact_basis token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty contact_basis token is rejected under COLLATE C'
);

select is(
  ('approved!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  ('opt_in!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated contact_basis token is rejected under COLLATE C'
);

select is(
  (E'approv\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  (E'referr\u00e1l' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII contact_basis token is rejected under COLLATE C'
);

select is(
  ('new' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('contacted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('replied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('not_interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('unsubscribed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('bounced' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('invalid' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select is(
  ('public_business_contact' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('referral' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('opt_in' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted contact_basis tokens match under COLLATE C'
);

select * from finish();
rollback;
