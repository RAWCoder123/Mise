-- Correction ledger events must carry a non-empty operator note.
--
-- Hosted `public.record_inventory_event` already accepts correction for
-- owner/admin/manager. Projection applies the signed delta to on-hand.
-- Without a required note, a manager JWT can rewrite stock under correction
-- semantics with no comparable explanation of why the repair happened.
--
-- Product writers that surface corrections in UI (#345 waste correction,
-- #350 receipt correction) already require a non-empty note and stamp it at
-- metadata.note (≤500 characters). This migration fails closed at the
-- database boundary for every insert path (record_inventory_event, outbox,
-- future service inserts). Receipt, count, waste, stockout, usage,
-- adjustment, and transfer keep their own evidence rules.
--
-- NOT VALID CHECK skips validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Orthogonal to correction-source allowlisting, supersede linkage, and
-- exact-reverse quantity contracts.

create or replace function private.enforce_inventory_correction_note_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  note_text text := nullif(
    pg_catalog.btrim(coalesce(new.metadata ->> 'note', '')),
    ''
  );
begin
  if new.event_type = 'correction' then
    if note_text is null then
      raise exception
        'Inventory correction events require a note'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_correction_note_evidence
  on public.inventory_events;
create trigger inventory_events_correction_note_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_correction_note_evidence();

revoke all on function private.enforce_inventory_correction_note_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_correction_note_evidence() is
  'Fail closed: correction inventory_events require a non-empty metadata.note matching the product correction writers.';

alter table public.inventory_events
  drop constraint if exists inventory_events_correction_note_check;
alter table public.inventory_events
  add constraint inventory_events_correction_note_check check (
    event_type <> 'correction'
    or nullif(pg_catalog.btrim(coalesce(metadata ->> 'note', '')), '') is not null
  ) not valid;

comment on constraint inventory_events_correction_note_check on public.inventory_events is
  'Correction rows require a non-empty metadata.note. NOT VALID skips legacy rows.';
