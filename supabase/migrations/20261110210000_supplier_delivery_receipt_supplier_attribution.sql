-- Stamp durable supplier attribution on order-path supplier delivery receipts.
--
-- Mark Received posts source = 'supplier_delivery' through record_supplier_delivery.
-- Those ledger rows historically carried free-text supplierName only. Purchasing and
-- learning need metadata.supplier_id equal to supplier_orders.supplier_id so the
-- receipt stays attributable after a supplier display-name rename.
--
-- The public record_supplier_delivery wrapper already requires a durable order
-- supplier_id (MISE-003C) and stamps audit_logs. This BEFORE INSERT trigger stamps
-- the matching inventory_events metadata from metadata.supplierOrderId without
-- redeclaring record_supplier_delivery or record_inventory_event — keeping the tip
-- alone-OK beside open receive/canonical-quantity tips (#392/#670/#1109/#1111).
--
-- Delivery RPC retries short-circuit on client_delivery_id already_applied before
-- another inventory insert, so stamped metadata does not create idempotency
-- conflicts on the operator Mark Received path.
--
-- Ad-hoc Log Delivery attribution is intentionally left alone.
--
-- Preserves authentication, manager role gates, tenant isolation, RLS, grants,
-- and append-only inventory_events behavior. Nothing is relaxed: this only
-- fail-closes supplier_delivery rows that cannot resolve a durable order supplier.

create or replace function private.stamp_supplier_delivery_receipt_supplier_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_supplier_id uuid;
  order_id uuid;
  provided text;
begin
  if new.event_type <> 'receipt' or new.source <> 'supplier_delivery' then
    return new;
  end if;

  if new.metadata is null or pg_catalog.jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'Inventory event evidence is incomplete' using errcode = '22023';
  end if;

  begin
    order_id := nullif(new.metadata ->> 'supplierOrderId', '')::uuid;
  exception
    when others then
      raise exception 'Supplier delivery receipts require the order''s durable supplier identity.'
        using errcode = '22023';
  end;

  if order_id is null then
    raise exception 'Supplier delivery receipts require the order''s durable supplier identity.'
      using errcode = '22023';
  end if;

  select orders.supplier_id
  into order_supplier_id
  from public.supplier_orders orders
  where orders.restaurant_id = new.restaurant_id
    and orders.id = order_id;

  if not found or order_supplier_id is null then
    raise exception 'Supplier delivery receipts require the order''s durable supplier identity.'
      using errcode = '22023';
  end if;

  if new.metadata ? 'supplier_id' then
    if pg_catalog.jsonb_typeof(new.metadata -> 'supplier_id') <> 'string' then
      raise exception 'Supplier delivery receipt identity must be a durable supplier UUID.'
        using errcode = '22023';
    end if;

    provided := new.metadata ->> 'supplier_id';
    if provided is null
      or provided <> pg_catalog.btrim(provided)
      or provided !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'Supplier delivery receipt identity must be a durable supplier UUID.'
        using errcode = '22023';
    end if;

    if lower(provided) is distinct from order_supplier_id::text then
      raise exception 'Supplier delivery receipt identity must match the supplier order.'
        using errcode = '22023';
    end if;
  end if;

  new.metadata := new.metadata || pg_catalog.jsonb_build_object(
    'supplier_id', order_supplier_id
  );

  return new;
end;
$$;

drop trigger if exists stamp_supplier_delivery_receipt_supplier_attribution
  on public.inventory_events;
create trigger stamp_supplier_delivery_receipt_supplier_attribution
before insert on public.inventory_events
for each row execute function private.stamp_supplier_delivery_receipt_supplier_attribution();

revoke all on function private.stamp_supplier_delivery_receipt_supplier_attribution()
  from public, anon, authenticated, service_role;

comment on function private.stamp_supplier_delivery_receipt_supplier_attribution() is
  'Stamps inventory_events.metadata.supplier_id for supplier_delivery receipts from the durable supplier_orders.supplier_id referenced by metadata.supplierOrderId.';
