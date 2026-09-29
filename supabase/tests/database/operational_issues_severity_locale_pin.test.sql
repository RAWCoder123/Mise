-- MISE-005CV: operational_issues.severity CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept an issue-severity identity the restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_severity_check'
  ),
  'operational_issues_severity_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_severity_check'
  ),
  'severity in \(''info'', ''watch'', ''warning'', ''critical''\)',
  'operational_issues severity CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_severity_check'
  ),
  'severity collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_issues severity CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('info' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token info matches under COLLATE C'
);

select is(
  ('watch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token watch matches under COLLATE C'
);

select is(
  ('warning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token warning matches under COLLATE C'
);

select is(
  ('critical' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token critical matches under COLLATE C'
);

select is(
  ('war ning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced severity token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty severity token is rejected under COLLATE C'
);

select is(
  ('warning!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated severity token is rejected under COLLATE C'
);

select is(
  (E'warn\u00efng' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII severity token is rejected under COLLATE C'
);

select is(
  ('info' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('watch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('warning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('critical' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted severity tokens match under COLLATE C'
);

select * from finish();
rollback;
