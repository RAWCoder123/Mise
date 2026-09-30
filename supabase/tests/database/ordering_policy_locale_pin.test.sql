-- MISE-005DF: system and restaurant ordering_policy CHECKs must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an ordering-policy identity the restored
-- C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_ordering_policy_check'
  ),
  'system_operational_controls_ordering_policy_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_operational_controls'::regclass
      and conname = 'restaurant_operational_controls_ordering_policy_check'
  ),
  'restaurant_operational_controls_ordering_policy_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_ordering_policy_check'
  ),
  'ordering_policy in \(''off'', ''draft_only''\)',
  'system_operational_controls ordering_policy CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.system_operational_controls'::regclass
      and conname = 'system_operational_controls_ordering_policy_check'
  ),
  'ordering_policy collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'system_operational_controls ordering_policy CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_operational_controls'::regclass
      and conname = 'restaurant_operational_controls_ordering_policy_check'
  ),
  'ordering_policy in \(''off'', ''draft_only''\)',
  'restaurant_operational_controls ordering_policy CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_operational_controls'::regclass
      and conname = 'restaurant_operational_controls_ordering_policy_check'
  ),
  'ordering_policy collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_operational_controls ordering_policy CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('off' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token off matches under COLLATE C'
);

select is(
  ('draft_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft_only matches under COLLATE C'
);

select is(
  ('draft only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced ordering_policy token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty ordering_policy token is rejected under COLLATE C'
);

select is(
  ('draft_only!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated ordering_policy token is rejected under COLLATE C'
);

select is(
  (E'draft_onl\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII ordering_policy token is rejected under COLLATE C'
);

select is(
  ('off' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('draft_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted ordering_policy tokens match under COLLATE C'
);

select * from finish();
rollback;
