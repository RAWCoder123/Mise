-- MISE-005EB: private.operational_mode_changes.prior_mode and
-- private.operational_mode_changes.next_mode CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a prior/next mode token the restored
-- C-locale gate would refuse.
begin;
select plan(20);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_prior_mode_check'
  ),
  'operational_mode_changes_prior_mode_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_prior_mode_check'
  ),
  'prior_mode in \(''normal'', ''read_only'', ''integrations_paused'', ''emergency''\)',
  'operational_mode_changes prior_mode CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_prior_mode_check'
  ),
  'prior_mode collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_mode_changes prior_mode CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_next_mode_check'
  ),
  'operational_mode_changes_next_mode_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_next_mode_check'
  ),
  'next_mode in \(''normal'', ''read_only'', ''integrations_paused'', ''emergency''\)',
  'operational_mode_changes next_mode CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.operational_mode_changes'::regclass
      and conname = 'operational_mode_changes_next_mode_check'
  ),
  'next_mode collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_mode_changes next_mode CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token normal matches under COLLATE C'
);

select is(
  ('read_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token read_only matches under COLLATE C'
);

select is(
  ('integrations_paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations_paused matches under COLLATE C'
);

select is(
  ('emergency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token emergency matches under COLLATE C'
);

select is(
  ('read only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced prior_mode token is rejected under COLLATE C'
);

select is(
  ('read only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced next_mode token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty prior_mode token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty next_mode token is rejected under COLLATE C'
);

select is(
  ('emergency!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated prior_mode token is rejected under COLLATE C'
);

select is(
  ('emergency!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated next_mode token is rejected under COLLATE C'
);

select is(
  (E'emergenc\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII prior_mode token is rejected under COLLATE C'
);

select is(
  (E'emergenc\u00e9' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII next_mode token is rejected under COLLATE C'
);

select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('read_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations_paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('emergency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted prior_mode tokens match under COLLATE C'
);

select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('read_only' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations_paused' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('emergency' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted next_mode tokens match under COLLATE C'
);

select * from finish();
rollback;
