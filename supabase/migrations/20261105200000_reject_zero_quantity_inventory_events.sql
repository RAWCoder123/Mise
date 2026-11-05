-- Ledger integrity: reject zero-quantity inventory movements.
--
-- Operator validation already blocks zero receipt and waste quantities.
-- Hosted record_inventory_event, count-session approval paths that insert
-- non-count rows, the device inventory outbox, and demo acceptInventoryEvent
-- still allowed quantity = 0 for receipt / waste / usage / adjustment /
-- transfer / correction. Those rows are append-only noops: they do not move
-- on-hand, but they pollute ledger history, waste analysis, activity, and
-- idempotency keys.
--
-- Count may still observe zero on hand. Stockout remains an explicit zero.
--
-- A BEFORE INSERT trigger covers every write path without re-declaring
-- record_inventory_event, so this composes with sibling ledger migrations
-- (future-dating, evidence bounds, magnitude, far-past effective_at).
-- A matching CHECK is added NOT VALID so new inserts are defended without
-- failing the migration if a historical noop row already exists hosted.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior. Nothing is
-- relaxed: this only rejects inserts that were previously accepted.

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_nonzero_movement_check
    check (
      event_type in ('count', 'stockout')
      or (event_type in ('receipt', 'waste', 'usage') and quantity > 0)
      or (event_type in ('adjustment', 'transfer', 'correction') and quantity <> 0)
    ) not valid;
exception
  when duplicate_object then null;
end
$$;

create or replace function private.reject_zero_quantity_inventory_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type not in ('count', 'stockout')
    and new.quantity = 0
  then
    raise exception 'Inventory ledger events other than count and stockout cannot have a zero quantity'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_zero_quantity_inventory_event
  on public.inventory_events;
create trigger reject_zero_quantity_inventory_event
before insert on public.inventory_events
for each row execute function private.reject_zero_quantity_inventory_event();

comment on function private.reject_zero_quantity_inventory_event() is
  'Rejects inventory_events rows with quantity 0 unless the type is count or stockout, so noop movements cannot pollute append-only ledger history.';
