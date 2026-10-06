-- MISE-005IY: ingest document-reference cntrl preflight must use COLLATE "C"
-- so writer acceptance cannot drift from the purchase_lines CHECK after
-- locale change.
-- Plan derived from assertion call sites below (count select is/ok/matches).
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'ingest_purchase_lines'
      and pg_get_function_identity_arguments(oid) =
        'uuid, text, text, jsonb, uuid, uuid'
  ),
  'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid) exists'
);

select matches(
  pg_get_functiondef(
    'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure
  ),
  'document_reference collate "C" ~ ''\[\[:cntrl:\]\]''',
  'ingest document-reference cntrl preflight uses COLLATE C'
);

select ok(
  pg_get_functiondef(
    'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure
  ) !~ 'document_reference ~ ''\[\[:cntrl:\]\]''',
  'ingest document-reference cntrl preflight is not bare POSIX'
);

select matches(
  pg_get_functiondef(
    'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)'::regprocedure
  ),
  'pg_catalog\.length\(document_reference\) > 200',
  'ingest preserves document-reference length bound'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated retains EXECUTE on ingest_purchase_lines'
);

select is(
  has_function_privilege(
    'anon',
    'public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)',
    'EXECUTE'
  ),
  false,
  'anon lacks EXECUTE on ingest_purchase_lines'
);

select * from finish();
rollback;
