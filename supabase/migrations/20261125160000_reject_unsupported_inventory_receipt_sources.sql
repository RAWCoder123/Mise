-- Fail closed inventory receipt sources outside the production write-path labels.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- Production receipts only stamp:
--   - operator_receipt (ad-hoc Log Delivery / inventory receive)
--   - supplier_delivery (record_supplier_delivery / Mark received)
-- An authenticated owner/admin/manager could therefore append a receipt with an
-- arbitrary source such as `receiving`, `manual`, or a forged write-path label.
-- That:
--   - still moves on-hand
--   - dodges double-count guards that key on exact `operator_receipt`
--   - forges or blanks delivery-history source badges that classify those labels
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- outbox replay, record_supplier_delivery, and any future SECURITY DEFINER
-- caller. Exact trim match (no case folding) keeps `Supplier_Delivery` from
-- bypassing the separate same-tenant delivery provenance guard.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed. Orthogonal to supplier_delivery provenance
-- (#1259), which requires a matching delivery row rather than allowing the
-- label itself.

create or replace function private.reject_unsupported_inventory_receipt_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'receipt'
    and btrim(coalesce(new.source, '')) not in ('operator_receipt', 'supplier_delivery')
  then
    raise exception
      'Inventory receipt source must be operator_receipt or supplier_delivery'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_unsupported_inventory_receipt_source
  on public.inventory_events;
create trigger reject_unsupported_inventory_receipt_source
before insert on public.inventory_events
for each row execute function private.reject_unsupported_inventory_receipt_source();

revoke all on function private.reject_unsupported_inventory_receipt_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_unsupported_inventory_receipt_source() is
  'Rejects inventory_events receipt rows whose source is outside {operator_receipt, supplier_delivery}, so arbitrary labels cannot move on-hand while dodging write-path guards and history classification.';
