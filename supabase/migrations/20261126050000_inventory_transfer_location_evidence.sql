-- Transfer ledger events must carry distinct from/to storage location ids.
--
-- Hosted `public.record_inventory_event` already accepts transfer for
-- owner/admin/manager. On current main, non-specialized projection adds the
-- event quantity to on-hand. Without bounded station provenance, a manager JWT
-- can rewrite stock under transfer semantics with missing or free-form
-- metadata that cannot be compared for Activity / station-transfer analysis.
--
-- The production station-transfer writer (PR #1100 `transfer_inventory`) stamps:
--   metadata.from_storage_location_id
--   metadata.to_storage_location_id
-- as distinct UUIDs for active same-restaurant locations. This migration fails
-- closed at the database boundary for every insert path (record_inventory_event,
-- outbox, future service inserts) by requiring those two metadata keys as
-- distinct UUID strings. It does not create storage_locations or enforce FK
-- membership — that stays with #1100. Reason-code and source allowlisting stay
-- with their own tips.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to transfer-reason / transfer-source allowlisting.

create or replace function private.enforce_inventory_transfer_location_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  from_id text := nullif(
    pg_catalog.btrim(coalesce(new.metadata ->> 'from_storage_location_id', '')),
    ''
  );
  to_id text := nullif(
    pg_catalog.btrim(coalesce(new.metadata ->> 'to_storage_location_id', '')),
    ''
  );
  uuid_shape text :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  if new.event_type = 'transfer' then
    if from_id is null
       or to_id is null
       or from_id !~ uuid_shape
       or to_id !~ uuid_shape then
      raise exception
        'Inventory transfer events require from and to storage location ids'
        using errcode = '22023';
    end if;
    if lower(from_id) = lower(to_id) then
      raise exception
        'Inventory transfer storage locations are invalid'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_transfer_location_evidence
  on public.inventory_events;
create trigger inventory_events_transfer_location_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_transfer_location_evidence();

revoke all on function private.enforce_inventory_transfer_location_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_transfer_location_evidence() is
  'Fail closed: transfer inventory_events require distinct UUID from/to storage location ids in metadata.';

alter table public.inventory_events
  drop constraint if exists inventory_events_transfer_location_check;
alter table public.inventory_events
  add constraint inventory_events_transfer_location_check check (
    event_type <> 'transfer'
    or (
      nullif(pg_catalog.btrim(coalesce(metadata ->> 'from_storage_location_id', '')), '')
        is not null
      and nullif(pg_catalog.btrim(coalesce(metadata ->> 'to_storage_location_id', '')), '')
        is not null
      and pg_catalog.btrim(coalesce(metadata ->> 'from_storage_location_id', ''))
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and pg_catalog.btrim(coalesce(metadata ->> 'to_storage_location_id', ''))
        ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      and lower(pg_catalog.btrim(coalesce(metadata ->> 'from_storage_location_id', '')))
        <> lower(pg_catalog.btrim(coalesce(metadata ->> 'to_storage_location_id', '')))
    )
  ) not valid;

comment on constraint inventory_events_transfer_location_check on public.inventory_events is
  'Transfer rows require distinct UUID from/to storage location ids in metadata. NOT VALID skips legacy rows.';
