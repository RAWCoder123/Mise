-- Ledger integrity: bound inventory_events.source_reference length.
--
-- Operator validation already caps source references at 200 characters via
-- requireInventoryOperation. The authenticated record_inventory_event RPC and
-- every other inventory_events insert path still accepted unbounded
-- source_reference text, so a direct caller could store megabyte-scale
-- references and inflate audit/export/activity payloads.
--
-- A BEFORE INSERT trigger is used rather than re-declaring record_inventory_event
-- so every write path shares one rule (RPC, count-session approval, outbox) and
-- so this additive migration composes with sibling ledger RPC replacements
-- (reason/metadata bounds, future-dating). A matching CHECK constraint hard-caps
-- the column for every insert path.
--
-- Limit matches services/domain/securityLimits.ts:
--   INVENTORY_EVENT_SOURCE_REFERENCE_MAX_CHARACTERS = 200
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, every existing grant and revoke, and append-only behavior. Nothing is
-- relaxed: this only rejects inserts that were previously accepted.

do $$
begin
  alter table public.inventory_events
    add constraint inventory_events_source_reference_length_check
    check (
      source_reference is null
      or char_length(source_reference) <= 200
    );
exception
  when duplicate_object then null;
end
$$;

create or replace function private.reject_oversized_inventory_event_source_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_reference is not null
    and pg_catalog.char_length(new.source_reference) > 200
  then
    raise exception 'Inventory event source reference is too long'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists reject_oversized_inventory_event_source_reference
  on public.inventory_events;
create trigger reject_oversized_inventory_event_source_reference
before insert on public.inventory_events
for each row execute function private.reject_oversized_inventory_event_source_reference();

comment on function private.reject_oversized_inventory_event_source_reference() is
  'Rejects inventory_events rows whose source_reference exceeds 200 characters so unbounded ledger references cannot inflate audit or export payloads.';
