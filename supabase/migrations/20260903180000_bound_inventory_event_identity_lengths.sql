-- Ledger integrity: clear fail-closed messages for oversized identity fields.
--
-- Foundation already CHECKs inventory_events.source (80), client_event_id (200),
-- and idempotency_key (240) via length(trim(...)). Domain acceptInventoryEvent and
-- the device outbox still treated those fields as unbounded strings, so demo and
-- offline paths could accept oversized identity payloads. On hosted inserts the
-- bare CHECK surfaces as SQLSTATE 23514, which the outbox transport does not map
-- to a terminal rejection — so oversized identity would retry forever.
--
-- A BEFORE INSERT trigger raises a clear 22023 message for every write path
-- (RPC, count-session approval, outbox) without re-declaring
-- record_inventory_event, so this composes with sibling ledger migrations.
-- Existing column CHECKs remain the hard cap; nothing is relaxed or truncated
-- (truncating would forge a different idempotency key).
--
-- Limits match services/domain/securityLimits.ts:
--   INVENTORY_EVENT_SOURCE_MAX_CHARACTERS = 80
--   INVENTORY_EVENT_CLIENT_EVENT_ID_MAX_CHARACTERS = 200
--   INVENTORY_EVENT_IDEMPOTENCY_KEY_MAX_CHARACTERS = 240
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior.

create or replace function private.reject_oversized_inventory_event_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.char_length(pg_catalog.btrim(new.source)) > 80 then
    raise exception 'Inventory event source is too long'
      using errcode = '22023';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(new.client_event_id)) > 200 then
    raise exception 'Inventory event client event id is too long'
      using errcode = '22023';
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(new.idempotency_key)) > 240 then
    raise exception 'Inventory event idempotency key is too long'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_oversized_inventory_event_identity
  on public.inventory_events;
create trigger reject_oversized_inventory_event_identity
before insert on public.inventory_events
for each row execute function private.reject_oversized_inventory_event_identity();

comment on function private.reject_oversized_inventory_event_identity() is
  'Rejects inventory_events rows whose trimmed source, client_event_id, or idempotency_key exceed foundation length CHECKs, with terminal 22023 messages the outbox can map without retrying forever.';
