-- MISE-005AF: operational_finding_decisions.policy_version shape must use
-- COLLATE "C" so restore CHECKs and finding-feedback RPC preflights cannot
-- diverge under locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_policy_version_check'
  ),
  'operational_finding_decisions_policy_version_check exists'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.operational_finding_decisions'::regclass
        and conname = 'operational_finding_decisions_policy_version_check'
    )
  ),
  'policy_version collate "C" ~',
  'finding policy_version CHECK uses COLLATE C'
);

select ok(
  (
    select count(*) = 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ 'policy_version'
  ),
  'exactly one policy_version CHECK remains on operational_finding_decisions'
);

select matches(
  pg_get_functiondef(
    'public.record_operational_finding_decision(uuid, text, text, text, timestamptz, text, text, numeric, jsonb, text, text, text, text)'::regprocedure
  ),
  'trim\(p_policy_version\) collate "C" !~ ''\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$''',
  'record_operational_finding_decision policy_version gate uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'public.record_operational_finding_decision(uuid, text, text, text, timestamptz, text, text, numeric, jsonb, text, text, text, text)'::regprocedure
  ) !~ 'trim\(p_policy_version\) !~ ''\^\[a-z0-9\]\[a-z0-9\._-\]\{2,63\}\$''',
  'record_operational_finding_decision policy_version gate is no longer bare'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_operational_finding_decision(uuid, text, text, text, timestamptz, text, text, numeric, jsonb, text, text, text, text)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on record_operational_finding_decision'
);

select * from finish();
rollback;
