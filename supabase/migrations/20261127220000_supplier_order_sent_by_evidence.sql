-- Supplier-order inserts that claim sent/completed status must carry
-- sent_by_user_id.
--
-- `public.supplier_orders.sent_by_user_id` is nullable so draft rows
-- legitimately leave it null until a later send or complete UPDATE stamps
-- the actor. There is intentionally no table-level NOT NULL /
-- status-implies-actor CHECK, because drafts are the normal INSERT shape
-- and history must not rewrite send attribution.
--
-- The existing `supplier_orders_email_delivery_check` only pairs
-- provider_message_id / sent_at / sent_by_user_id when email_provider is set.
-- Writers normally INSERT draft supplier orders and only later UPDATE into
-- status = 'sent' / 'completed' with a stamped sent_by_user_id, but any
-- INSERT that reaches the table can still mint a terminal claim with
-- email_provider null and sent_by_user_id null. Client and service_role DML
-- are revoked; SECURITY DEFINER / direct INSERT paths still reach the table.
--
-- This migration fails closed at the database boundary for every INSERT
-- (RPC writer, future service inserts) when status is already 'sent' or
-- 'completed' and sent_by_user_id is null. Draft inserts and mark-sent
-- UPDATEs remain allowed — there is intentionally no NOT NULL /
-- status-implies-actor CHECK, so this tip stays INSERT-only.
--
-- Soft CHECKs, FKs, grants/revokes, tenant isolation, and RLS stay in place.
-- Does not rewrite any supplier-order writer. History is never rewritten.
-- Nothing is relaxed. Orthogonal to supplier-order locale / cntrl pins,
-- Gmail delivery CHECK pairing, and purchase-order submitted_at tips.

create or replace function private.enforce_supplier_order_sent_by_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('sent', 'completed')
    and new.sent_by_user_id is null
  then
    raise exception
      'Supplier order sender is required'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists supplier_orders_sent_by_evidence
  on public.supplier_orders;
create trigger supplier_orders_sent_by_evidence
before insert on public.supplier_orders
for each row execute function private.enforce_supplier_order_sent_by_evidence();

revoke all on function private.enforce_supplier_order_sent_by_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_supplier_order_sent_by_evidence() is
  'Fail closed: supplier_orders INSERT requires a non-null sent_by_user_id when status is sent or completed. Draft inserts and mark-sent UPDATEs remain permitted.';
