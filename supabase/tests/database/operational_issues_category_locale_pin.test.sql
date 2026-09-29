-- MISE-005CU: operational_issues.category CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept an issue-category identity the restored C-locale gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_category_check'
  ),
  'operational_issues_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_category_check'
  ),
  'category in \(''inventory'', ''orders'', ''sales'', ''team'', ''waste'', ''integrations'', ''tasks'', ''system''\)',
  'operational_issues category CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_category_check'
  ),
  'category collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_issues category CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory matches under COLLATE C'
);

select is(
  ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token orders matches under COLLATE C'
);

select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sales matches under COLLATE C'
);

select is(
  ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token team matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations matches under COLLATE C'
);

select is(
  ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token tasks matches under COLLATE C'
);

select is(
  ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token system matches under COLLATE C'
);

select is(
  ('in ventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced category token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty category token is rejected under COLLATE C'
);

select is(
  ('inventory!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated category token is rejected under COLLATE C'
);

select is(
  (E'invent\u00f6ry' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII category token is rejected under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('tasks' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('system' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted category tokens match under COLLATE C'
);

select * from finish();
rollback;
