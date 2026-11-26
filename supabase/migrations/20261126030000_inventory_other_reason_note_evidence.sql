-- Waste/stockout rows with reason_code = 'other' must carry a non-empty note.
--
-- Hosted `public.record_inventory_event` already accepts waste and stockout for
-- owner/admin/manager. Projection subtracts waste and zeroes stockout on-hand.
-- Named reason codes are comparable on their own. The catch-all `other` code is
-- not: without a free-text note, a manager JWT can rewrite stock under those
-- semantics with no comparable explanation of what "other" meant.
--
-- Product writers (#301 / #1098 waste; #366 stockout) keep notes optional for
-- named reasons and stamp optional notes at metadata.note (≤500 characters).
-- This migration fails closed only when reason_code is exactly `other`. Full
-- reason allowlists (#1270 / #1271), source allowlists, and UI/i18n stay with
-- their own tips.
--
-- NOT VALID CHECK skips validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reasons.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_inventory_other_reason_note_evidence()
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
  if new.event_type in ('waste', 'stockout')
     and new.reason_code = 'other'
     and note_text is null then
    if new.event_type = 'waste' then
      raise exception
        'Inventory waste events with reason other require a note'
        using errcode = '22023';
    end if;
    raise exception
      'Inventory stockout events with reason other require a note'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_other_reason_note_evidence
  on public.inventory_events;
create trigger inventory_events_other_reason_note_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_other_reason_note_evidence();

revoke all on function private.enforce_inventory_other_reason_note_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_other_reason_note_evidence() is
  'Fail closed: waste/stockout inventory_events with reason_code other require a non-empty metadata.note.';

alter table public.inventory_events
  drop constraint if exists inventory_events_other_reason_note_check;
alter table public.inventory_events
  add constraint inventory_events_other_reason_note_check check (
    event_type not in ('waste', 'stockout')
    or reason_code is distinct from 'other'
    or nullif(pg_catalog.btrim(coalesce(metadata ->> 'note', '')), '') is not null
  ) not valid;

comment on constraint inventory_events_other_reason_note_check on public.inventory_events is
  'Waste/stockout rows with reason_code other require a non-empty metadata.note. NOT VALID skips legacy rows.';
