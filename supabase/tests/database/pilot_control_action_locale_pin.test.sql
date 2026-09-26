-- MISE-005Y: service_apply_pilot_operational_control action/reason lower and
-- reason shape must use COLLATE "C" so pilot kill-switch allowlisting and
-- immutable request replay cannot diverge under locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'service_apply_pilot_operational_control'
      and pg_get_function_identity_arguments(oid) =
        'uuid, uuid, text, uuid, text'
  ),
  'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text) exists'
);

select matches(
  pg_get_functiondef(
    'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)'::regprocedure
  ),
  'normalized_action text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_action, ''''\)\) collate "C"\s*\) collate "C"',
  'pilot control action lower/btrim uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)'::regprocedure
  ),
  'normalized_reason text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reason_code, ''''\)\) collate "C"\s*\) collate "C"',
  'pilot control reason lower/btrim uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)'::regprocedure
  ),
  'normalized_reason collate "C" !~ ''\^\[a-z0-9_\]\{3,64\}\$''',
  'pilot control reason shape check uses COLLATE C'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on service_apply_pilot_operational_control'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_apply_pilot_operational_control(uuid, uuid, text, uuid, text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on service_apply_pilot_operational_control'
);

select * from finish();
rollback;
