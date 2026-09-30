-- MISE-005DS: outreach_enrollments.status and
-- outreach_enrollments.claimed_from_status CHECKs must keep the exact-token
-- allowlists and pin ASCII shape under COLLATE "C" so dump/restore
-- cannot accept an enrollment-status or claim-origin token the restored
-- C-locale gate would refuse.
begin;
select plan(30);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_status_check'
  ),
  'outreach_enrollments_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_status_check'
  ),
  'status in \(''queued'', ''awaiting_review'', ''ready'', ''processing'', ''contacted'', ''replied'', ''interested'', ''not_interested'', ''completed'', ''suppressed'', ''attention_required''\)',
  'outreach_enrollments status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_enrollments status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_claimed_from_status_check'
  ),
  'outreach_enrollments_claimed_from_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_claimed_from_status_check'
  ),
  'claimed_from_status in \(''queued'', ''ready'', ''contacted''\)',
  'outreach_enrollments claimed_from_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_enrollments'::regclass
      and conname = 'outreach_enrollments_claimed_from_status_check'
  ),
  'claimed_from_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_enrollments claimed_from_status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token queued matches under COLLATE C'
);

select is(
  ('awaiting_review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token awaiting_review matches under COLLATE C'
);

select is(
  ('ready' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ready matches under COLLATE C'
);

select is(
  ('processing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token processing matches under COLLATE C'
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
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('suppressed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token suppressed matches under COLLATE C'
);

select is(
  ('attention_required' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token attention_required matches under COLLATE C'
);

select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token claimed_from queued matches under COLLATE C'
);

select is(
  ('ready' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token claimed_from ready matches under COLLATE C'
);

select is(
  ('contacted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token claimed_from contacted matches under COLLATE C'
);

select is(
  ('awaiting review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('awaiting review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced claimed_from_status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty claimed_from_status token is rejected under COLLATE C'
);

select is(
  ('ready!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  ('ready!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated claimed_from_status token is rejected under COLLATE C'
);

select is(
  (E'proce\u00dfing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  (E'read\u00ff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII claimed_from_status token is rejected under COLLATE C'
);

select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('awaiting_review' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ready' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('processing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('contacted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('replied' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('not_interested' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('suppressed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('attention_required' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select is(
  ('queued' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ready' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('contacted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted claimed_from_status tokens match under COLLATE C'
);

select * from finish();
rollback;
