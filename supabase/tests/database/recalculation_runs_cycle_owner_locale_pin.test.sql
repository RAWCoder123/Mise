-- MISE-005CM: recalculation_runs.cycle and monitoring_owner CHECKs must keep
-- the exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a schedule-identity the restored C-locale gate
-- would refuse.
begin;
select plan(22);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_check'
  ),
  'recalculation_runs_cycle_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_check'
  ),
  'cycle in \(''daily_open'', ''mid_shift'', ''close''\)',
  'recalculation_runs cycle CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_cycle_check'
  ),
  'cycle collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recalculation_runs cycle CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_monitoring_owner_check'
  ),
  'recalculation_runs_monitoring_owner_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_monitoring_owner_check'
  ),
  'monitoring_owner in \(''member'', ''manager'', ''owner_admin''\)',
  'recalculation_runs monitoring_owner CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_monitoring_owner_check'
  ),
  'monitoring_owner collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recalculation_runs monitoring_owner CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('daily_open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token daily_open matches under COLLATE C'
);

select is(
  ('mid_shift' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token mid_shift matches under COLLATE C'
);

select is(
  ('close' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token close matches under COLLATE C'
);

select is(
  ('member' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token member matches under COLLATE C'
);

select is(
  ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manager matches under COLLATE C'
);

select is(
  ('owner_admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token owner_admin matches under COLLATE C'
);

select is(
  ('daily open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced cycle token is rejected under COLLATE C'
);

select is(
  ('owner admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced monitoring_owner token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty cycle token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty monitoring_owner token is rejected under COLLATE C'
);

select is(
  ('close!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated cycle token is rejected under COLLATE C'
);

select is(
  ('manager!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated monitoring_owner token is rejected under COLLATE C'
);

select is(
  (E'daily_\u00f6pen' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII cycle token is rejected under COLLATE C'
);

select is(
  (E'owner_\u00e4dmin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII monitoring_owner token is rejected under COLLATE C'
);

select is(
  ('daily_open' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('mid_shift' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('close' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted cycle tokens match under COLLATE C'
);

select is(
  ('member' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('owner_admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted monitoring_owner tokens match under COLLATE C'
);

select * from finish();
rollback;
