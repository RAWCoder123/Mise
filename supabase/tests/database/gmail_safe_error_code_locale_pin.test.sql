-- MISE-005AE: private.gmail_safe_error_code shape must use COLLATE "C" so
-- Gmail/Square failure-code allowlisting cannot diverge under locale drift.
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'gmail_safe_error_code'
      and pg_get_function_identity_arguments(oid) = 'text'
  ),
  'private.gmail_safe_error_code(text) exists'
);

select matches(
  pg_get_functiondef(
    'private.gmail_safe_error_code(text)'::regprocedure
  ),
  'p_error_code collate "C" !~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'gmail_safe_error_code shape check uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'private.gmail_safe_error_code(text)'::regprocedure
  ) !~ 'p_error_code !~ ''\^\[a-z0-9_\]\{1,80\}\$''',
  'gmail_safe_error_code shape check is no longer bare'
);

select is(
  has_function_privilege(
    'service_role',
    'private.gmail_safe_error_code(text)',
    'EXECUTE'
  ),
  false,
  'service_role lacks EXECUTE on internal gmail_safe_error_code'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.gmail_safe_error_code(text)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on internal gmail_safe_error_code'
);

select * from finish();
rollback;
