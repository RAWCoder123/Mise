-- MISE-005DP: outreach_agent_runs.trigger_type and status CHECKs must
-- keep the exact-token allowlists and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a run-vocabulary identity the restored
-- C-locale gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_trigger_type_check'
  ),
  'outreach_agent_runs_trigger_type_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_status_check'
  ),
  'outreach_agent_runs_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_trigger_type_check'
  ),
  'trigger_type in \(''manual'', ''scheduled''\)',
  'outreach_agent_runs trigger_type CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_trigger_type_check'
  ),
  'trigger_type collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_agent_runs trigger_type CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_status_check'
  ),
  'status in \(''running'', ''completed'', ''failed''\)',
  'outreach_agent_runs status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_agent_runs'::regclass
      and conname = 'outreach_agent_runs_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'outreach_agent_runs status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual matches under COLLATE C'
);

select is(
  ('scheduled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token scheduled matches under COLLATE C'
);

select is(
  ('running' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token running matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token failed matches under COLLATE C'
);

select is(
  ('manual run' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced trigger_type token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty run vocabulary token is rejected under COLLATE C'
);

select is(
  ('failed!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'fail\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('manual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('scheduled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('running' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('failed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted trigger_type and status tokens match under COLLATE C'
);

select * from finish();
rollback;
