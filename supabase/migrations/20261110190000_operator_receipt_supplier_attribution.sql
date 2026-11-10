-- Stamp-and-validate durable supplier attribution on ad-hoc operator receipts.
--
-- Log Delivery / Inventory-detail receives post source = 'operator_receipt'.
-- Those ledger rows must carry metadata.supplier_id equal to the inventory
-- item's durable suppliers.id so purchasing and learning can attribute the
-- receipt without inventing identity from free-text notes.
--
-- Application repositories stamp the authoritative supplier_id before calling
-- record_inventory_event so idempotent retries compare equal metadata. This
-- BEFORE INSERT trigger is the fail-closed server gate for every write path
-- (manager RPC, device outbox flush) without redeclaring record_inventory_event
-- — keeping the tip alone-OK beside open receive/RPC tips.
--
-- Order-path receives (source = 'supplier_delivery') are intentionally left
-- alone; their durable order-line supplier attribution is a separate tip.
--
-- Preserves authentication, manager role gates, tenant isolation, RLS, grants,
-- and append-only inventory_events behavior. Nothing is relaxed: this only
-- rejects operator_receipt rows that lack matching durable supplier evidence.

create or replace function private.validate_operator_receipt_supplier_attribution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_supplier_id uuid;
  provided text;
begin
  if new.event_type <> 'receipt' or new.source <> 'operator_receipt' then
    return new;
  end if;

  if new.metadata is null or pg_catalog.jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'Inventory event evidence is incomplete' using errcode = '22023';
  end if;

  select item.supplier_id
  into item_supplier_id
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id;

  if not found or item_supplier_id is null then
    raise exception 'Ad-hoc receipts require the item''s durable supplier identity.'
      using errcode = '22023';
  end if;

  if not (new.metadata ? 'supplier_id') then
    raise exception 'Ad-hoc receipts require the item''s durable supplier identity.'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(new.metadata -> 'supplier_id') <> 'string' then
    raise exception 'Receipt supplier identity must be a durable supplier UUID.'
      using errcode = '22023';
  end if;

  provided := new.metadata ->> 'supplier_id';

  if provided is null
    or provided <> pg_catalog.btrim(provided)
    or provided !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'Receipt supplier identity must be a durable supplier UUID.'
      using errcode = '22023';
  end if;

  if lower(provided) is distinct from item_supplier_id::text then
    raise exception 'Receipt supplier identity must match the inventory item supplier.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_operator_receipt_supplier_attribution on public.inventory_events;
create trigger validate_operator_receipt_supplier_attribution
before insert on public.inventory_events
for each row execute function private.validate_operator_receipt_supplier_attribution();

revoke all on function private.validate_operator_receipt_supplier_attribution()
  from public, anon, authenticated, service_role;

comment on function private.validate_operator_receipt_supplier_attribution() is
  'Requires operator_receipt inventory_events to carry metadata.supplier_id matching the inventory item durable supplier, so ad-hoc Log Delivery receipts stay attributable.';
