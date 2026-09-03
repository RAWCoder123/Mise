-- Ledger integrity: bound inventory_events.quantity fractional scale.
--
-- Established canonical conversion paths already round to 6 decimal places
-- (e.g. round(native * factor, 6)). Domain and client paths still accepted
-- quantities with more fractional places, so floating-point dust and over-precise
-- payloads could append to the immutable ledger, inflate projections, and
-- create idempotency noise without changing meaningful on-hand stock.
--
-- A BEFORE INSERT trigger raises a clear 22023 message for every write path
-- (RPC, count-session approval, outbox) without re-declaring
-- record_inventory_event, so this composes with sibling ledger migrations
-- (magnitude, zero-quantity, identity lengths, evidence bounds). A matching
-- CHECK constraint hard-caps the column; NOT VALID avoids blocking deploy on
-- any legacy rows while the trigger rejects every new insert.
--
-- Limit matches services/domain/securityLimits.ts:
--   LEDGER_QUANTITY_MAX_SCALE = 6
-- Never round oversized scale into a different quantity — reject so
-- idempotency keys remain exact.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior. Nothing is
-- relaxed: this only rejects inserts that were previously accepted.

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_quantity_scale_check
    check (scale(quantity) <= 6) not valid;
exception
  when duplicate_object then null;
end
$$;

create or replace function private.reject_oversized_inventory_event_quantity_scale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.quantity is null
    or pg_catalog.scale(new.quantity) > 6
  then
    raise exception 'Inventory event quantity scale exceeds supported limits'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_oversized_inventory_event_quantity_scale
  on public.inventory_events;
create trigger reject_oversized_inventory_event_quantity_scale
before insert on public.inventory_events
for each row execute function private.reject_oversized_inventory_event_quantity_scale();

comment on function private.reject_oversized_inventory_event_quantity_scale() is
  'Rejects inventory_events rows whose quantity has more than 6 fractional decimal places so floating-point dust cannot pollute append-only ledger history.';
