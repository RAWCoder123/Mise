-- MISE-005BP: scoped Square sync writer must reject control-bearing sync
-- cursors under COLLATE "C" before prepare / base apply, matching the
-- MISE-005BM pos_integrations.sync_cursor CHECK contract.
begin;
select plan(5);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'service_apply_square_sync_result_scoped'
      and pg_get_function_identity_arguments(oid)
        = 'uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date'
  ),
  'private.service_apply_square_sync_result_scoped(...) exists'
);

select matches(
  pg_get_functiondef(
    'private.service_apply_square_sync_result_scoped(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date)'::regprocedure
  ),
  'normalized_sync_cursor collate "C" ~ ''\[\[:cntrl:\]\]''',
  'scoped sync_cursor cntrl preflight uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_apply_square_sync_result_scoped(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date)'::regprocedure
  ),
  'Square sync cursor is invalid',
  'scoped sync_cursor preflight raises clear invalid-cursor error'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_apply_square_sync_result_scoped(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date)',
    'EXECUTE'
  ),
  true,
  'service_role retains EXECUTE on scoped Square sync apply'
);

select is(
  has_function_privilege(
    'authenticated',
    'private.service_apply_square_sync_result_scoped(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date)',
    'EXECUTE'
  ),
  false,
  'authenticated lacks EXECUTE on scoped Square sync apply'
);

select * from finish();
rollback;
