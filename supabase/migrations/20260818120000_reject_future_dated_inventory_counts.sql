-- MISE-001 correction: physical-count evidence may not be effective in the future.
--
-- `public.record_inventory_event` validated only that `p_effective_at` is not null,
-- so an authenticated owner/admin/manager could append a `count` row effective days
-- ahead. Because `inventory_events` is append-only and projects into
-- `inventory_items.current_quantity`, that row would become the newest count for the
-- item: it would present as fresh authoritative evidence, it would hide the latest
-- valid count, and it could release recommendation suppression.
--
-- A BEFORE INSERT trigger is used rather than re-declaring the RPC so every write
-- path is covered by one rule: `record_inventory_event`, the count-session approval
-- RPC, and the device inventory outbox. A CHECK constraint cannot express this
-- because `now()` is not immutable.
--
-- Scope: `count` rows only. That is the evidence MISE-001 makes authoritative.
-- Future-dating of receipt/waste/adjustment rows is a separate, pre-existing ledger
-- integrity question and is deliberately left unchanged here.
--
-- The two-minute tolerance is the device/server clock-skew allowance shared with
-- COUNT_CLOCK_SKEW_TOLERANCE_MS in services/domain/inventoryCountAuthority.ts and
-- with the count filter in private.fetch_operational_planning_snapshot, so the
-- client, the Edge planning path, and the database agree on which counts exist.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation, RLS,
-- every existing grant and revoke, and append-only behavior. Nothing is relaxed:
-- this only rejects inserts that were previously accepted.

create or replace function private.reject_future_dated_inventory_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'count'
    and new.effective_at > clock_timestamp() + interval '2 minutes'
  then
    raise exception 'Physical count evidence cannot be effective in the future'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_future_dated_inventory_count on public.inventory_events;
create trigger reject_future_dated_inventory_count
before insert on public.inventory_events
for each row execute function private.reject_future_dated_inventory_count();

comment on function private.reject_future_dated_inventory_count() is
  'Rejects inventory_events count rows effective more than two minutes ahead of the server clock, so future-dated evidence cannot be treated as an authoritative physical count.';
