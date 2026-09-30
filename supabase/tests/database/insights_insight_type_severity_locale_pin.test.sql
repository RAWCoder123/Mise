-- MISE-005DC: insights.insight_type and severity CHECKs must keep the
-- exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an insight-vocabulary identity the restored
-- C-locale gate would refuse.
begin;
select plan(20);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_insight_type_check'
  ),
  'insights_insight_type_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_severity_check'
  ),
  'insights_severity_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_insight_type_check'
  ),
  'insight_type in \(''sales'', ''inventory'', ''waste'', ''cost'', ''prep'', ''ordering''\)',
  'insights insight_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_insight_type_check'
  ),
  'insight_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'insights insight_type CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_severity_check'
  ),
  'severity in \(''info'', ''warning'', ''urgent''\)',
  'insights severity CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_severity_check'
  ),
  'severity collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'insights severity CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token sales matches under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory matches under COLLATE C'
);

select is(
  ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waste matches under COLLATE C'
);

select is(
  ('cost' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cost matches under COLLATE C'
);

select is(
  ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prep matches under COLLATE C'
);

select is(
  ('ordering' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ordering matches under COLLATE C'
);

select is(
  ('info' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token info matches under COLLATE C'
);

select is(
  ('warning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token warning matches under COLLATE C'
);

select is(
  ('urgent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token urgent matches under COLLATE C'
);

select is(
  ('sales mix' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced insight_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty insight vocabulary token is rejected under COLLATE C'
);

select is(
  ('urgent!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated severity token is rejected under COLLATE C'
);

select is(
  (E'urg\u00e9nt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII severity token is rejected under COLLATE C'
);

select is(
  ('sales' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('waste' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cost' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ordering' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('info' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('warning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('urgent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted insight_type and severity tokens match under COLLATE C'
);

select * from finish();
rollback;
