-- Sales-import inserts that claim failed status must carry error_message.
--
-- `public.sales_imports.error_message` is nullable because non-failure
-- statuses (queued, processing, completed) legitimately leave it null.
-- Hosted service_record_square_sync_failure already stamps a bounded reason
-- into error_message when INSERTing status = 'failed', but any INSERT that
-- reaches the table can still mint a failed import with error_message null
-- or blank after trim.
--
-- Client DML is revoked; service_role / direct INSERT paths still reach the
-- table. Writers that INSERT queued/processing/completed rows leave
-- error_message null until a later failure path stamps evidence.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'failed' and error_message is null/blank after trim.
-- Non-failure inserts and failure UPDATEs remain allowed — there is
-- intentionally no NOT NULL / status-implies-error CHECK, because a CHECK
-- would block legitimate non-failure rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite Square sync / CSV import writers. History is never
-- rewritten. Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1321 and mise_actions failure evidence (#1305).

create or replace function private.enforce_sales_import_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'failed'
    and nullif(btrim(new.error_message), '') is null
  then
    raise exception
      'Sales import failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists sales_imports_failure_evidence
  on public.sales_imports;
create trigger sales_imports_failure_evidence
before insert on public.sales_imports
for each row execute function private.enforce_sales_import_failure_evidence();

revoke all on function private.enforce_sales_import_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_sales_import_failure_evidence() is
  'Fail closed: sales_imports INSERT requires a non-empty error_message when status is failed. Non-failure inserts and failure UPDATEs remain permitted.';
