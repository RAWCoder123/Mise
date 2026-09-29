-- MISE-005CN: pos_integrations.status and restaurant_email_connections.status
-- CHECKs must keep the exact-token allowlists and pin ASCII shape under
-- COLLATE "C" so dump/restore cannot accept a connection-lifecycle identity
-- the restored C-locale gate would refuse.
begin;
select plan(22);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_status_check'
  ),
  'pos_integrations_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_status_check'
  ),
  'status in \(''not_connected'', ''connected'', ''paused'', ''error''\)',
  'pos_integrations status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pos_integrations status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_status_check'
  ),
  'restaurant_email_connections_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_status_check'
  ),
  'status in \(''not_connected'', ''connected'', ''needs_reauth'', ''restricted''\)',
  'restaurant_email_connections status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_email_connections status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('not_connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token not_connected matches under COLLATE C'
);

select is(
  ('connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token connected matches under COLLATE C'
);

select is(
  ('paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token paused matches under COLLATE C'
);

select is(
  ('error' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token error matches under COLLATE C'
);

select is(
  ('needs_reauth' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token needs_reauth matches under COLLATE C'
);

select is(
  ('restricted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token restricted matches under COLLATE C'
);

select is(
  ('not connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced POS status token is rejected under COLLATE C'
);

select is(
  ('needs reauth' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced email status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty POS status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty email status token is rejected under COLLATE C'
);

select is(
  ('paused!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated POS status token is rejected under COLLATE C'
);

select is(
  ('restricted!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated email status token is rejected under COLLATE C'
);

select is(
  (E'err\u00f6r' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII POS status token is rejected under COLLATE C'
);

select is(
  (E'needs_re\u00e4uth' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII email status token is rejected under COLLATE C'
);

select is(
  ('not_connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('error' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted POS status tokens match under COLLATE C'
);

select is(
  ('not_connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('connected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('needs_reauth' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('restricted' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted email status tokens match under COLLATE C'
);

select * from finish();
rollback;
