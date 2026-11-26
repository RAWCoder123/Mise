-- Inventory ledger source_reference must not be blank or padded when present.
--
-- Hosted `public.record_inventory_event` already nullif-trims blank
-- `p_source_reference` values before insert. On current main, every other
-- insert path (direct service inserts, count-session approval, future writers)
-- can still stamp whitespace-only or padded source_reference text onto the
-- append-only ledger.
--
-- Blank padding invents a parallel identity beside null / the trimmed label,
-- so outbox replay can conflict with the hosted nullif-trim store and Activity
-- / write-path provenance cannot treat padding as a real reference.
--
-- This migration fails closed at the database boundary for every insert path
-- when `source_reference` is present but blank after trim, or when it retains
-- leading/trailing whitespace. Null remains allowed. Length-only bounds stay
-- with their own tips.
--
-- NOT VALID CHECKs skip validating any pre-existing rows so history is never
-- rewritten; new inserts are still enforced by the BEFORE INSERT trigger.
-- Domain acceptInventoryEvent mirrors the same rejection reason.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.
-- Does not rewrite `record_inventory_event`. Orthogonal to source/reason
-- slug tips, evidence length bounds, and ASCII-C operator-path pins.

create or replace function private.enforce_inventory_blank_source_reference_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source_reference is not null
     and (
       btrim(new.source_reference) = ''
       or new.source_reference <> btrim(new.source_reference)
     ) then
    raise exception
      'Inventory event source reference must be non-blank and unpadded'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_blank_source_reference_evidence
  on public.inventory_events;
create trigger inventory_events_blank_source_reference_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_blank_source_reference_evidence();

revoke all on function private.enforce_inventory_blank_source_reference_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_blank_source_reference_evidence() is
  'Fail closed: inventory_events.source_reference must be null or trimmed non-empty.';

alter table public.inventory_events
  drop constraint if exists inventory_events_source_reference_nonblank_check;
alter table public.inventory_events
  add constraint inventory_events_source_reference_nonblank_check check (
    source_reference is null
    or (
      btrim(source_reference) <> ''
      and source_reference = btrim(source_reference)
    )
  ) not valid;

comment on constraint inventory_events_source_reference_nonblank_check on public.inventory_events is
  'source_reference must be null or trimmed non-empty. NOT VALID skips legacy rows.';
