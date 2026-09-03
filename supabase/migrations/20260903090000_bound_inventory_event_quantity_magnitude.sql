-- Ledger integrity: bound inventory_events.quantity magnitude.
--
-- Operator validation already caps inventory quantities at 1_000_000 via
-- requireInventoryOperation / operatingLimits.inventoryQuantity. The
-- authenticated record_inventory_event RPC and every other inventory_events
-- insert path only rejected null/sign mismatches for the event type, so a
-- direct caller could store absurd canonical magnitudes (especially before
-- unit conversion) and inflate ledger, audit, and export payloads. Retained
-- (projection_applied = false) rows also bypassed the on-hand projection ceiling.
--
-- A BEFORE INSERT trigger is used rather than re-declaring record_inventory_event
-- so every write path shares one rule (RPC, count-session approval, outbox) and
-- so this additive migration composes with sibling ledger RPC replacements
-- (reason/metadata bounds, source_reference bounds, future-dating). A matching
-- CHECK constraint hard-caps the column for every insert path.
--
-- Limit matches services/domain/securityLimits.ts:
--   INVENTORY_EVENT_QUANTITY_MAX = 1_000_000
-- Signed event types (adjustment, transfer, correction) use abs(quantity).
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior. Nothing is
-- relaxed: this only rejects inserts that were previously accepted.

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_quantity_magnitude_check
    check (abs(quantity) <= 1000000);
exception
  when duplicate_object then null;
end
$$;

create or replace function private.reject_oversized_inventory_event_quantity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.quantity is null
    or abs(new.quantity) > 1000000
  then
    raise exception 'Inventory event quantity exceeds supported limits'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_oversized_inventory_event_quantity
  on public.inventory_events;
create trigger reject_oversized_inventory_event_quantity
before insert on public.inventory_events
for each row execute function private.reject_oversized_inventory_event_quantity();

comment on function private.reject_oversized_inventory_event_quantity() is
  'Rejects inventory_events rows whose absolute quantity exceeds 1_000_000 so unbounded ledger magnitudes cannot inflate projections, audit, or export payloads.';
