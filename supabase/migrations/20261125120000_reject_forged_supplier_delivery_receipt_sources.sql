-- Fail closed forged supplier_delivery inventory receipt sources.
--
-- `public.record_inventory_event` accepted any trimmed `p_source` (1–80 chars).
-- An authenticated owner/admin/manager could therefore append a receipt with
-- `source = 'supplier_delivery'` without naming a same-tenant delivery row.
-- That privileged label:
--   - suppresses Activity emission in capture_inventory_event_activity_v2
--   - falsifies order-path provenance used by receive history and guards
--   - still moves on-hand
--
-- Legitimate `public.record_supplier_delivery` already stamps
-- `source = 'supplier_delivery'` and `source_reference = delivery_row.id`
-- after inserting the delivery row, so this rule accepts that path unchanged.
--
-- A BEFORE INSERT trigger is used rather than re-declaring the RPC so every
-- write path is covered: record_inventory_event, outbox replay, and any future
-- SECURITY DEFINER caller. Preserves auth, role gates, tenant isolation, RLS,
-- grants, and append-only behavior. Nothing is relaxed.

create or replace function private.reject_forged_supplier_delivery_receipt_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  delivery_id uuid;
begin
  if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
    begin
      delivery_id := nullif(btrim(coalesce(new.source_reference, '')), '')::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Supplier delivery receipt source requires a matching same-tenant delivery'
          using errcode = '22023';
    end;

    if delivery_id is null
      or not exists (
        select 1
        from public.supplier_deliveries delivery
        where delivery.restaurant_id = new.restaurant_id
          and delivery.id = delivery_id
      )
    then
      raise exception
        'Supplier delivery receipt source requires a matching same-tenant delivery'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reject_forged_supplier_delivery_receipt_source
  on public.inventory_events;
create trigger reject_forged_supplier_delivery_receipt_source
before insert on public.inventory_events
for each row execute function private.reject_forged_supplier_delivery_receipt_source();

revoke all on function private.reject_forged_supplier_delivery_receipt_source()
  from public, anon, authenticated, service_role;

comment on function private.reject_forged_supplier_delivery_receipt_source() is
  'Rejects inventory_events receipt rows that claim source=supplier_delivery without a same-tenant supplier_deliveries id in source_reference, so forged order-path provenance cannot suppress Activity or inflate on-hand.';
