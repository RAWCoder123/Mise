-- Ledger integrity: reject inventory_events effective more than 90 days ago.
--
-- Future-dated counts are already blocked (MISE-001), and open work broadens
-- that guard to every event type. The opposite failure mode remained open:
-- an authenticated manager (or a direct RPC / outbox replay) could append a
-- receipt, waste, count, or correction with an epoch-era or multi-year-old
-- effective_at. Append-only ledger projection and count-boundary ordering
-- then treat that timestamp as authoritative history, scrambling on-hand
-- reconstruction and purchase recommendations.
--
-- A BEFORE INSERT trigger covers every write path: record_inventory_event,
-- count-session approval, and the device inventory outbox. A CHECK constraint
-- cannot express this because clock_timestamp() is not immutable.
--
-- The 90-day ceiling matches
-- INVENTORY_EVENT_EFFECTIVE_AT_MAX_LOOKBACK_MS in services/domain/securityLimits.ts
-- and the domain accept path in services/domain/inventoryLedger.ts. It is
-- deliberately wider than purchase-authority count freshness (36 hours) so
-- multi-week offline outbox sync and late delivery/waste logging still work,
-- while blocking absurd backdating.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior. Nothing is
-- relaxed: this only rejects inserts that were previously accepted.

create or replace function private.reject_far_past_inventory_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.effective_at < clock_timestamp() - interval '90 days' then
    raise exception 'Inventory ledger events cannot be effective more than 90 days in the past'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_far_past_inventory_event on public.inventory_events;
create trigger reject_far_past_inventory_event
before insert on public.inventory_events
for each row execute function private.reject_far_past_inventory_event();

comment on function private.reject_far_past_inventory_event() is
  'Rejects inventory_events rows effective more than 90 days before the server clock, so epoch-era or absurdly backdated ledger evidence cannot scramble on-hand projection.';
