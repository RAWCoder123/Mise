-- Transfer ledger events must carry an allowlisted reason_code.
--
-- Hosted `public.record_inventory_event` already accepts transfer for
-- owner/admin/manager. On current main, non-specialized projection adds the
-- event quantity to on-hand. Without a bounded reason taxonomy, a manager JWT
-- can rewrite stock under transfer semantics with a missing or free-form
-- reason that cannot be compared for Activity / station-transfer provenance.
--
-- The production station-transfer writer (PR #1100 `transfer_inventory`) stamps:
--   station_transfer
-- Notes remain optional. Source allowlisting (`transfer_inventory`) stays with
-- its own tip. This migration fails closed at the database boundary for every
-- insert path (record_inventory_event, outbox, future service inserts).
-- Receipt, count, waste, stockout, usage, adjustment, and correction keep
-- their own evidence rules.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to transfer-source allowlisting and transfer location metadata.

create or replace function private.enforce_inventory_transfer_reason_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(new.reason_code, '')), '');
begin
  if new.event_type = 'transfer' then
    if normalized_reason is null then
      raise exception
        'Inventory transfer events require a reason code'
        using errcode = '22023';
    end if;
    if normalized_reason not in (
      'station_transfer'
    ) then
      raise exception
        'Inventory transfer reason code is not allowed'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_transfer_reason_evidence
  on public.inventory_events;
create trigger inventory_events_transfer_reason_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_transfer_reason_evidence();

revoke all on function private.enforce_inventory_transfer_reason_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_transfer_reason_evidence() is
  'Fail closed: transfer inventory_events require an allowlisted reason_code matching the product station-transfer writer.';

alter table public.inventory_events
  drop constraint if exists inventory_events_transfer_reason_check;
alter table public.inventory_events
  add constraint inventory_events_transfer_reason_check check (
    event_type <> 'transfer'
    or reason_code in (
      'station_transfer'
    )
  ) not valid;

comment on constraint inventory_events_transfer_reason_check on public.inventory_events is
  'Transfer rows require an allowlisted reason_code. NOT VALID skips legacy rows.';
