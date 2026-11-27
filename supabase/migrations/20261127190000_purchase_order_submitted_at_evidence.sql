-- Purchase-order inserts that claim submitted/received status must carry
-- submitted_at.
--
-- `public.purchase_orders.submitted_at` is nullable so draft / cancelled rows
-- legitimately leave it null until a later submit or receive UPDATE stamps
-- the timestamp. There is intentionally no table-level NOT NULL /
-- status-implies-timestamp CHECK, because drafts are the normal INSERT shape
-- and history must not rewrite submission time.
--
-- Writers normally INSERT draft purchase orders and only later UPDATE into
-- status = 'submitted' / 'received' with a stamped submitted_at, but any
-- INSERT that reaches the table can still mint a terminal claim with
-- submitted_at null. Client DML is revoked; service_role / direct INSERT
-- paths still reach the table.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is already 'submitted' or
-- 'received' and submitted_at is null. Draft / cancelled inserts and submit
-- UPDATEs remain allowed — there is intentionally no NOT NULL /
-- status-implies-timestamp CHECK, so this tip stays INSERT-only.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite any purchase writer. History is never rewritten.
-- Nothing is relaxed. Orthogonal to purchase-orders locale / supplier-name
-- pins and inventory count-session submitted_at CHECKs.

create or replace function private.enforce_purchase_order_submitted_at_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('submitted', 'received')
    and new.submitted_at is null
  then
    raise exception
      'Purchase order submission time is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_orders_submitted_at_evidence
  on public.purchase_orders;
create trigger purchase_orders_submitted_at_evidence
before insert on public.purchase_orders
for each row execute function private.enforce_purchase_order_submitted_at_evidence();

revoke all on function private.enforce_purchase_order_submitted_at_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_order_submitted_at_evidence() is
  'Fail closed: purchase_orders INSERT requires a non-null submitted_at when status is submitted or received. Draft/cancelled inserts and submit UPDATEs remain permitted.';
