-- MISE-005DT: outreach_messages.status CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a message-status token the restored C-locale gate would refuse.
begin;
select plan(19);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_status_check'
  ),
  'outreach_messages_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_status_check'
  ),
  'status in \(''draft'', ''approved'', ''sending'', ''sent'', ''delivered'', ''failed'', ''send_unknown'', ''bounced'', ''complained'', ''suppressed'', ''cancelled''\)',
  'outreach_messages status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_messages status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft matches under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('sending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sending matches under COLLATE C'
);

select is(
  ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sent matches under COLLATE C'
);

select is(
  ('delivered' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token delivered matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('send_unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token send_unknown matches under COLLATE C'
);

select is(
  ('bounced' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token bounced matches under COLLATE C'
);

select is(
  ('complained' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token complained matches under COLLATE C'
);

select is(
  ('suppressed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token suppressed matches under COLLATE C'
);

select is(
  ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cancelled matches under COLLATE C'
);

select is(
  ('send unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('draft!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'sen\u00f0' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('delivered' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('send_unknown' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('bounced' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('complained' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('suppressed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
