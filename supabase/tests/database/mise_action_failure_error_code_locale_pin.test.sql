-- MISE-005AG: private.service_record_mise_action_failure error_code shape must
-- use COLLATE "C" so mise_actions failure-code allowlisting cannot diverge
-- under locale drift.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'service_record_mise_action_failure'
      and pg_get_function_identity_arguments(oid) =
        'uuid, uuid, uuid, text, text, text'
  ),
  'private.service_record_mise_action_failure(...) exists'
);

select matches(
  pg_get_functiondef(
    'private.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)'::regprocedure
  ),
  'p_error_code collate "C" !~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'mise_action failure error_code shape check uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'private.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)'::regprocedure
  ) !~ 'p_error_code !~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'mise_action failure error_code shape check is no longer bare'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on public service_record_mise_action_failure'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on public service_record_mise_action_failure'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on private service_record_mise_action_failure'
);

select * from finish();
rollback;
