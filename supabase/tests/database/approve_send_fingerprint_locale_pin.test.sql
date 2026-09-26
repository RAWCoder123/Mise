-- MISE-005X: approve_supplier_send_content reviewed fingerprint lower must
-- use COLLATE "C" so approval cannot diverge from builder fingerprint bytes
-- under locale drift.
begin;
select plan(4);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'approve_supplier_send_content'
      and pg_get_function_identity_arguments(oid) = 'uuid, uuid, uuid, text'
  ),
  'public.approve_supplier_send_content(uuid, uuid, uuid, text) exists'
);

select matches(
  pg_get_functiondef(
    'public.approve_supplier_send_content(uuid, uuid, uuid, text)'::regprocedure
  ),
  'reviewed_fingerprint text := pg_catalog\.lower\(\s*pg_catalog\.btrim\(coalesce\(p_reviewed_content_fingerprint, ''''\)\) collate "C"\s*\) collate "C"',
  'approve reviewed fingerprint lower/btrim uses COLLATE C'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.approve_supplier_send_content(uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on approve_supplier_send_content'
);

select is(
  has_function_privilege(
    'service_role',
    'public.approve_supplier_send_content(uuid, uuid, uuid, text)',
    'EXECUTE'
  ),
  false,
  'service_role lacks EXECUTE on approve_supplier_send_content'
);

select * from finish();
rollback;
