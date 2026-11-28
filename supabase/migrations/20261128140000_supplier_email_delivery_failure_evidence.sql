-- Supplier-email delivery inserts that claim failed/unknown must carry
-- last_error_code.
--
-- `private.supplier_email_deliveries.last_error_code` is nullable because
-- in-flight sending rows and successful sent rows legitimately leave it null.
-- Hosted fail / unknown transitions already stamp a bounded slug into
-- last_error_code, but any INSERT that reaches the table can still mint a
-- failed or unknown delivery with last_error_code null or blank after trim.
--
-- Client and service_role DML are revoked; SECURITY DEFINER / direct INSERT
-- paths still reach the table. Claim writers INSERT status = 'sending' with
-- last_error_code null until a later fail/unknown path stamps evidence.
--
-- This migration fails closed at the database boundary for every INSERT when
-- status is already 'failed' or 'unknown' and last_error_code is null/blank
-- after trim. Sending/sent inserts and failure UPDATEs remain allowed — there
-- is intentionally no NOT NULL / status-implies-error CHECK, because a CHECK
-- would block legitimate sending/sent rows.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite Gmail claim / outcome writers. History is never rewritten.
-- Nothing is relaxed.
-- Alone-OK vs tip stacks #1263–#1322 and mise_actions failure evidence (#1305).

create or replace function private.enforce_supplier_email_delivery_failure_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('failed', 'unknown')
    and nullif(btrim(new.last_error_code), '') is null
  then
    raise exception
      'Supplier email delivery failure evidence is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_email_deliveries_failure_evidence
  on private.supplier_email_deliveries;
create trigger supplier_email_deliveries_failure_evidence
before insert on private.supplier_email_deliveries
for each row execute function private.enforce_supplier_email_delivery_failure_evidence();

revoke all on function private.enforce_supplier_email_delivery_failure_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_supplier_email_delivery_failure_evidence() is
  'Fail closed: supplier_email_deliveries INSERT requires a non-empty last_error_code when status is failed or unknown. Sending/sent inserts and failure UPDATEs remain permitted.';
