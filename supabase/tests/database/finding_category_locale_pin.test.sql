-- MISE-005EG: public.operational_finding_decisions.finding_category CHECK
-- must keep the exact-token allowlist and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a finding-category vocabulary token the
-- restored C-locale gate would refuse.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_finding_category_check'
  ),
  'operational_finding_decisions_finding_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_finding_category_check'
  ),
  'finding_category in \(''inventory'', ''ordering'', ''sales'', ''waste'', ''prep'', ''cost'', ''data_quality''\)',
  'operational_finding_decisions finding_category CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_finding_category_check'
  ),
  'finding_category collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'operational_finding_decisions finding_category CHECK uses COLLATE C'
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
  ('ordering' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ordering matches under COLLATE C'
);

select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sales matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prep matches under COLLATE C'
);

select is(
  ('cost' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cost matches under COLLATE C'
);

select is(
  ('data_quality' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token data_quality matches under COLLATE C'
);

select is(
  ('data quality' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced finding_category token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty finding_category token is rejected under COLLATE C'
);

select is(
  ('inventory!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated finding_category token is rejected under COLLATE C'
);

select is(
  (E'inventor\u00ff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII finding_category token is rejected under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ordering' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cost' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('data_quality' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted finding_category tokens match under COLLATE C'
);

select * from finish();
rollback;
