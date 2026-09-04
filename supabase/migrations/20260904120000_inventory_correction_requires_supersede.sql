-- Inventory corrections must point at the mistaken ledger row they repair.
--
-- Prior CHECK inventory_event_supersedes_check only said: if supersedes_event_id
-- is set, the type must be correction. That left orphan corrections legal
-- (event_type = correction AND supersedes_event_id IS NULL). Those rows project
-- as arbitrary signed on-hand deltas under false "correction" semantics without
-- linking to anything, so a manager JWT could inflate or deflate stock without
-- an auditable supersede target.
--
-- Product writers (#345 waste correction, #350 receipt correction) already stamp
-- supersedes_event_id. This migration fails closed at the database boundary for
-- every insert path (record_inventory_event, future service inserts, outbox).
--
-- NOT VALID on the tightened CHECK skips validating any pre-existing orphan
-- rows so history is never rewritten; new inserts are still enforced. The
-- BEFORE INSERT trigger matches domain acceptInventoryEvent rejection
-- (correction_requires_supersede).
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_inventory_correction_supersede()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'correction' and new.supersedes_event_id is null then
    raise exception 'Inventory corrections must supersede a prior ledger event'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_inventory_correction_supersede()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_events_correction_requires_supersede
  on public.inventory_events;

create trigger inventory_events_correction_requires_supersede
  before insert on public.inventory_events
  for each row
  execute function private.enforce_inventory_correction_supersede();

comment on function private.enforce_inventory_correction_supersede() is
  'Fail closed: inventory_events correction rows must set supersedes_event_id to a prior same-tenant ledger event.';

alter table public.inventory_events
  drop constraint if exists inventory_event_supersedes_check;

alter table public.inventory_events
  add constraint inventory_event_supersedes_check check (
    (event_type = 'correction') = (supersedes_event_id is not null)
  ) not valid;

comment on constraint inventory_event_supersedes_check on public.inventory_events is
  'Corrections require supersedes_event_id; non-corrections must leave it null. NOT VALID skips legacy orphan rows.';
