-- MISE-005Z: service_set_system_operational_mode reason_code shape must use
-- COLLATE "C" so emergency-mode reason allowlisting and immutable request
-- replay cannot diverge under locale drift.
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'service_set_system_operational_mode'
      and pg_get_function_identity_arguments(oid) =
        'uuid, text, text, uuid'
  ),
  'public.service_set_system_operational_mode(uuid, text, text, uuid) exists'
);

select matches(
  pg_get_functiondef(
    'public.service_set_system_operational_mode(uuid, text, text, uuid)'::regprocedure
  ),
  'p_reason_code collate "C" !~ ''\^\[a-z0-9_\]\{3,64\}\$''',
  'operational mode reason shape check uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'public.service_set_system_operational_mode(uuid, text, text, uuid)'::regprocedure
  ) !~ 'p_reason_code !~ ''\^\[a-z0-9_\]\{3,64\}\$''',
  'operational mode reason shape check is no longer bare'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_set_system_operational_mode(uuid, text, text, uuid)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on service_set_system_operational_mode'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_set_system_operational_mode(uuid, text, text, uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on service_set_system_operational_mode'
);

select * from finish();
rollback;
