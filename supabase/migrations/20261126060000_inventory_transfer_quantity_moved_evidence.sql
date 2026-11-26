-- Transfer ledger events must carry a positive metadata.quantity_moved.
--
-- Hosted `public.record_inventory_event` already accepts transfer for
-- owner/admin/manager. On current main, non-specialized projection adds the
-- event quantity to on-hand. Without movable-amount provenance, a manager JWT
-- can rewrite stock under transfer semantics with missing or free-form
-- metadata that cannot be compared for Activity / station-transfer analysis.
--
-- The production station-transfer writer (PR #1100 `transfer_inventory`) stamps:
--   metadata.quantity_moved
-- as a finite number strictly greater than zero (alongside from/to location
-- ids covered by a separate tip). This migration fails closed at the database
-- boundary for every insert path (record_inventory_event, outbox, future
-- service inserts) by requiring that JSON number. It does not force ledger
-- quantity = 0, create storage_locations, or FK-check location ids.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to transfer-location / transfer-reason / transfer-source tips.

create or replace function private.enforce_inventory_transfer_quantity_moved_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  raw jsonb;
  moved numeric;
begin
  if new.event_type = 'transfer' then
    raw := new.metadata -> 'quantity_moved';
    if raw is null
       or pg_catalog.jsonb_typeof(raw) <> 'number' then
      raise exception
        'Inventory transfer events require a positive quantity_moved'
        using errcode = '22023';
    end if;

    begin
      moved := (new.metadata ->> 'quantity_moved')::numeric;
    exception
      when others then
        raise exception
          'Inventory transfer events require a positive quantity_moved'
          using errcode = '22023';
    end;

    if moved is null or moved <= 0 then
      raise exception
        'Inventory transfer events require a positive quantity_moved'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_transfer_quantity_moved_evidence
  on public.inventory_events;
create trigger inventory_events_transfer_quantity_moved_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_transfer_quantity_moved_evidence();

revoke all on function private.enforce_inventory_transfer_quantity_moved_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_transfer_quantity_moved_evidence() is
  'Fail closed: transfer inventory_events require metadata.quantity_moved as a finite number > 0.';

alter table public.inventory_events
  drop constraint if exists inventory_events_transfer_quantity_moved_check;
alter table public.inventory_events
  add constraint inventory_events_transfer_quantity_moved_check check (
    event_type <> 'transfer'
    or (
      metadata ? 'quantity_moved'
      and pg_catalog.jsonb_typeof(metadata -> 'quantity_moved') = 'number'
      and (metadata ->> 'quantity_moved')::numeric > 0
    )
  ) not valid;

comment on constraint inventory_events_transfer_quantity_moved_check on public.inventory_events is
  'Transfer rows require metadata.quantity_moved as a JSON number > 0. NOT VALID skips legacy rows.';
