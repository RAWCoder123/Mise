-- Supplier delivery inserts must carry a verified_by actor.
--
-- `public.supplier_deliveries.verified_by` is nullable so account-deletion
-- anonymization can clear only the deleted operator's auth identity while
-- preserving the delivery's operational history (ON DELETE SET NULL).
-- Hosted public.record_supplier_delivery stamps auth.uid() into verified_by,
-- but any insert path that reaches the table can still mint an unattributable
-- delivery receipt with verified_by null.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when verified_by is null.
-- Account-deletion anonymization UPDATEs remain allowed — there is
-- intentionally no NOT NULL CHECK, because a CHECK would block the
-- ON DELETE SET NULL escape.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite record_supplier_delivery. History is never rewritten.
-- Nothing is relaxed.

create or replace function private.enforce_supplier_delivery_verified_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.verified_by is null then
    raise exception
      'Supplier delivery verifier is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_deliveries_verified_by_evidence
  on public.supplier_deliveries;
create trigger supplier_deliveries_verified_by_evidence
before insert on public.supplier_deliveries
for each row execute function private.enforce_supplier_delivery_verified_by_evidence();

revoke all on function private.enforce_supplier_delivery_verified_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_supplier_delivery_verified_by_evidence() is
  'Fail closed: supplier_deliveries INSERT requires a non-null verified_by. Account-deletion anonymization UPDATEs remain permitted.';
