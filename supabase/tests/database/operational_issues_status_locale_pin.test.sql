-- MISE-005CW: operational_issues.status CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept an issue-status identity the restored C-locale gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_status_check'
  ),
  'operational_issues_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_status_check'
  ),
  'status in \(''open'', ''monitoring'', ''action_prepared'', ''resolved'', ''dismissed'', ''expired''\)',
  'operational_issues status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_issues status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token open matches under COLLATE C'
);

select is(
  ('monitoring' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token monitoring matches under COLLATE C'
);

select is(
  ('action_prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token action_prepared matches under COLLATE C'
);

select is(
  ('resolved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token resolved matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('expired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token expired matches under COLLATE C'
);

select is(
  ('action prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('open!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'op\u00ebn' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('monitoring' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('action_prepared' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('resolved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('expired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
