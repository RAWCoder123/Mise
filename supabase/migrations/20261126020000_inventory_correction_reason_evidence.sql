-- Correction ledger events must carry an allowlisted reason_code.
--
-- Hosted `public.record_inventory_event` already accepts correction for
-- owner/admin/manager. Projection applies the signed delta to on-hand.
-- Without a bounded reason taxonomy, a manager JWT can rewrite stock under
-- correction semantics with a missing or free-form reason that cannot be
-- compared for correction analysis or Activity provenance.
--
-- Product writers that surface corrections in UI (#345 waste correction,
-- #350 receipt correction) stamp:
--   waste_correction | receipt_correction
-- Notes, source allowlisting, supersede linkage, and exact-reverse quantity
-- contracts stay with their own tips. This migration fails closed at the
-- database boundary for every insert path (record_inventory_event, outbox,
-- future service inserts). Receipt, count, waste, stockout, usage,
-- adjustment, and transfer keep their own evidence rules.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to correction-note evidence and correction-source allowlisting.

create or replace function private.enforce_inventory_correction_reason_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_reason text := nullif(pg_catalog.btrim(coalesce(new.reason_code, '')), '');
begin
  if new.event_type = 'correction' then
    if normalized_reason is null then
      raise exception
        'Inventory correction events require a reason code'
        using errcode = '22023';
    end if;
    if normalized_reason not in (
      'waste_correction',
      'receipt_correction'
    ) then
      raise exception
        'Inventory correction reason code is not allowed'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_correction_reason_evidence
  on public.inventory_events;
create trigger inventory_events_correction_reason_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_correction_reason_evidence();

revoke all on function private.enforce_inventory_correction_reason_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_correction_reason_evidence() is
  'Fail closed: correction inventory_events require an allowlisted reason_code matching the product correction writers.';

alter table public.inventory_events
  drop constraint if exists inventory_events_correction_reason_check;
alter table public.inventory_events
  add constraint inventory_events_correction_reason_check check (
    event_type <> 'correction'
    or reason_code in (
      'waste_correction',
      'receipt_correction'
    )
  ) not valid;

comment on constraint inventory_events_correction_reason_check on public.inventory_events is
  'Correction rows require an allowlisted reason_code. NOT VALID skips legacy rows.';
