-- MISE-005DK: pos_integrations.provider and
-- restaurant_email_connections.provider CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a connection-provider identity the
-- restored C-locale gate would refuse.
begin;
select plan(23);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_provider_check'
  ),
  'pos_integrations_provider_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_provider_check'
  ),
  'provider in \(''square'', ''toast'', ''clover'', ''lightspeed'', ''manual_csv'', ''demo''\)',
  'pos_integrations provider CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_integrations'::regclass
      and conname = 'pos_integrations_provider_check'
  ),
  'provider collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pos_integrations provider CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_provider_check'
  ),
  'restaurant_email_connections_provider_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_provider_check'
  ),
  'provider in \(''gmail''\)',
  'restaurant_email_connections provider CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_provider_check'
  ),
  'provider collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_email_connections provider CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token square matches under COLLATE C'
);

select is(
  ('toast' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token toast matches under COLLATE C'
);

select is(
  ('clover' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token clover matches under COLLATE C'
);

select is(
  ('lightspeed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token lightspeed matches under COLLATE C'
);

select is(
  ('manual_csv' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual_csv matches under COLLATE C'
);

select is(
  ('demo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token demo matches under COLLATE C'
);

select is(
  ('gmail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token gmail matches under COLLATE C'
);

select is(
  ('manual csv' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced POS provider token is rejected under COLLATE C'
);

select is(
  ('g mail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced email provider token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty POS provider token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty email provider token is rejected under COLLATE C'
);

select is(
  ('square!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated POS provider token is rejected under COLLATE C'
);

select is(
  ('gmail!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated email provider token is rejected under COLLATE C'
);

select is(
  (E'squ\u00e0re' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII POS provider token is rejected under COLLATE C'
);

select is(
  (E'gm\u00e4il' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII email provider token is rejected under COLLATE C'
);

select is(
  ('square' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('toast' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('clover' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('lightspeed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manual_csv' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('demo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted POS provider tokens match under COLLATE C'
);

select is(
  ('gmail' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted email provider tokens match under COLLATE C'
);

select * from finish();
rollback;
