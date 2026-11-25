-- Bound inventory ledger evidence fields that managers can supply through
-- public.record_inventory_event.
--
-- inventory_events already caps source (1–80), client_event_id (1–200), and
-- idempotency_key (1–240). metadata, source_reference, and reason_code stayed
-- unbounded, so an authenticated owner/admin/manager could append megabyte-scale
-- JSON or free-text onto the append-only ledger (including supplier_delivery
-- receipts that skip Activity emission). That is not required for any production
-- writer: operator notes are already capped at 500 characters client-side, and
-- server-built delivery/count metadata is a handful of UUIDs and numbers.
--
-- A BEFORE INSERT trigger rejects oversized evidence with SQLSTATE 22023 so the
-- device outbox can settle the failure as a terminal rejection. Table CHECKs
-- remain as defense in depth for any insert path that bypasses the trigger
-- message contract.
--
-- Preserves auth, role gates, tenant isolation, RLS, grants, and append-only
-- behavior. Nothing is relaxed.

create or replace function private.reject_oversized_inventory_event_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.pg_column_size(coalesce(new.metadata, '{}'::jsonb)) > 8192 then
    raise exception
      'Inventory event metadata exceeds the bounded size'
      using errcode = '22023';
  end if;

  if new.source_reference is not null
    and char_length(new.source_reference) > 200
  then
    raise exception
      'Inventory event source reference exceeds the bounded length'
      using errcode = '22023';
  end if;

  if new.reason_code is not null
    and char_length(new.reason_code) > 80
  then
    raise exception
      'Inventory event reason code exceeds the bounded length'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_oversized_inventory_event_evidence
  on public.inventory_events;
create trigger reject_oversized_inventory_event_evidence
before insert on public.inventory_events
for each row execute function private.reject_oversized_inventory_event_evidence();

revoke all on function private.reject_oversized_inventory_event_evidence()
  from public, anon, authenticated, service_role;

comment on function private.reject_oversized_inventory_event_evidence() is
  'Rejects inventory_events inserts whose metadata, source_reference, or reason_code exceed the bounded evidence sizes used by operator and server writers.';

alter table public.inventory_events
  drop constraint if exists inventory_events_metadata_bound_check;
alter table public.inventory_events
  add constraint inventory_events_metadata_bound_check
  check (pg_catalog.pg_column_size(metadata) <= 8192);

alter table public.inventory_events
  drop constraint if exists inventory_events_source_reference_bound_check;
alter table public.inventory_events
  add constraint inventory_events_source_reference_bound_check
  check (
    source_reference is null
    or char_length(source_reference) <= 200
  );

alter table public.inventory_events
  drop constraint if exists inventory_events_reason_code_bound_check;
alter table public.inventory_events
  add constraint inventory_events_reason_code_bound_check
  check (
    reason_code is null
    or char_length(reason_code) <= 80
  );

comment on constraint inventory_events_metadata_bound_check on public.inventory_events is
  'Keeps append-only inventory ledger metadata within 8 KiB of stored jsonb.';

comment on constraint inventory_events_source_reference_bound_check on public.inventory_events is
  'Keeps inventory event source_reference within the 200-character operator evidence bound.';

comment on constraint inventory_events_reason_code_bound_check on public.inventory_events is
  'Keeps inventory event reason_code within the 80-character operator evidence bound.';
