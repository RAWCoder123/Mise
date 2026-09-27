-- MISE-005AH: operational_finding_decisions.finding_id shape must use
-- COLLATE "C" so restore CHECKs and finding-feedback RPC preflights cannot
-- diverge under locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and conname = 'operational_finding_decisions_finding_id_shape_check'
  ),
  'operational_finding_decisions_finding_id_shape_check exists'
);

select matches(
  pg_get_constraintdef(
    (
      select oid
      from pg_constraint
      where conrelid = 'public.operational_finding_decisions'::regclass
        and conname = 'operational_finding_decisions_finding_id_shape_check'
    )
  ),
  'finding_id collate "C" ~',
  'finding_id shape CHECK uses COLLATE C'
);

select ok(
  (
    select count(*) = 1
    from pg_constraint
    where conrelid = 'public.operational_finding_decisions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ 'finding:'
  ),
  'exactly one finding_id shape CHECK remains on operational_finding_decisions'
);

select matches(
  pg_get_functiondef(
    'public.record_operational_finding_decision(uuid, text, text, text, timestamptz, text, text, numeric, jsonb, text, text, text, text)'::regprocedure
  ),
  'trim\(p_finding_id\) collate "C" !~ ''\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$''',
  'record_operational_finding_decision finding_id gate uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'public.record_operational_finding_decision(uuid, text, text, text, timestamptz, text, text, numeric, jsonb, text, text, text, text)'::regprocedure
  ) !~ 'trim\(p_finding_id\) !~ ''\^finding:\[a-z0-9\]\[a-z0-9:_-\]\{1,231\}\$''',
  'record_operational_finding_decision finding_id gate is no longer bare'
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
