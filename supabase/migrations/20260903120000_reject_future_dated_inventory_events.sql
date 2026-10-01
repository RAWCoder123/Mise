-- Ledger integrity: reject future-dated inventory_events of every type.
--
-- MISE-001 already blocked future-dated `count` rows via
-- `private.reject_future_dated_inventory_count`. Receipt, waste, usage,
-- adjustment, transfer, stockout, and correction rows were deliberately left
-- open at that time. Those rows still project into
-- `inventory_items.current_quantity` when their `effective_at` is after the
-- item's count boundary, so a fast device clock (or a direct RPC) could silently
-- inflate or drain on-hand and distort purchase recommendations.
--
-- This migration broadens the same two-minute `clock_timestamp()` skew guard to
-- every `inventory_events.event_type`. The tolerance matches
-- COUNT_CLOCK_SKEW_TOLERANCE_MS in services/domain/inventoryCountAuthority.ts and
-- the domain accept path in services/domain/inventoryLedger.ts.
--
-- A BEFORE INSERT trigger covers every write path: `record_inventory_event`,
-- count-session approval, and the device inventory outbox. No privilege, RLS,
-- policy, or append-only behavior is relaxed — only previously accepted
-- future-dated inserts are rejected.

create or replace function private.reject_future_dated_inventory_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.effective_at > clock_timestamp() + interval '2 minutes' then
    if new.event_type = 'count' then
      raise exception 'Physical count evidence cannot be effective in the future'
        using errcode = '22023';
    end if;
    raise exception 'Inventory ledger events cannot be effective in the future'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Keep the historical function name as an identical guard so any residual
-- trigger or direct reference continues to enforce the broadened rule.
create or replace function private.reject_future_dated_inventory_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.effective_at > clock_timestamp() + interval '2 minutes' then
    if new.event_type = 'count' then
      raise exception 'Physical count evidence cannot be effective in the future'
        using errcode = '22023';
    end if;
    raise exception 'Inventory ledger events cannot be effective in the future'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_future_dated_inventory_count on public.inventory_events;
drop trigger if exists reject_future_dated_inventory_event on public.inventory_events;
create trigger reject_future_dated_inventory_event
before insert on public.inventory_events
for each row execute function private.reject_future_dated_inventory_event();

comment on function private.reject_future_dated_inventory_event() is
  'Rejects inventory_events rows of any type effective more than two minutes ahead of the server clock, so future-dated ledger evidence cannot project into on-hand quantity.';

comment on function private.reject_future_dated_inventory_count() is
  'Alias of reject_future_dated_inventory_event: rejects future-dated inventory_events of every type (historical name retained for compatibility).';
