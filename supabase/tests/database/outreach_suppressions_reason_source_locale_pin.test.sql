-- MISE-005DO: outreach_suppressions.reason and
-- outreach_suppressions.source CHECKs must keep the exact-token
-- allowlists and pin ASCII shape under COLLATE "C" so dump/restore
-- cannot accept a suppression reason or source token the restored
-- C-locale gate would refuse.
begin;
select plan(24);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_reason_check'
  ),
  'outreach_suppressions_reason_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_reason_check'
  ),
  'reason in \(''recipient_request'', ''hard_bounce'', ''spam_complaint'', ''provider_suppression'', ''manual''\)',
  'outreach_suppressions reason CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_reason_check'
  ),
  'reason collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_suppressions reason CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_source_check'
  ),
  'outreach_suppressions_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_source_check'
  ),
  'source in \(''unsubscribe'', ''resend_webhook'', ''operator''\)',
  'outreach_suppressions source CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_source_check'
  ),
  'source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_suppressions source CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('recipient_request' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token recipient_request matches under COLLATE C'
);

select is(
  ('hard_bounce' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token hard_bounce matches under COLLATE C'
);

select is(
  ('spam_complaint' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token spam_complaint matches under COLLATE C'
);

select is(
  ('provider_suppression' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token provider_suppression matches under COLLATE C'
);

select is(
  ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual matches under COLLATE C'
);

select is(
  ('unsubscribe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token unsubscribe matches under COLLATE C'
);

select is(
  ('resend_webhook' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token resend_webhook matches under COLLATE C'
);

select is(
  ('operator' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token operator matches under COLLATE C'
);

select is(
  ('recipient request' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced reason token is rejected under COLLATE C'
);

select is(
  ('resend webhook' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced source token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty reason token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty source token is rejected under COLLATE C'
);

select is(
  ('hard_bounce!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated reason token is rejected under COLLATE C'
);

select is(
  ('operator!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated source token is rejected under COLLATE C'
);

select is(
  (E'hard_bounc\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII reason token is rejected under COLLATE C'
);

select is(
  (E'operat\u00f6r' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII source token is rejected under COLLATE C'
);

select is(
  ('recipient_request' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('hard_bounce' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('spam_complaint' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('provider_suppression' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted reason tokens match under COLLATE C'
);

select is(
  ('unsubscribe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('resend_webhook' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('operator' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted source tokens match under COLLATE C'
);

select * from finish();
rollback;
