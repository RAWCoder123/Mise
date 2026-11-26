-- Inventory corrections must supersede an event for the same restaurant and
-- inventory item.
--
-- Hosted public.record_inventory_event already requires supersedes_event_id
-- (when present) to resolve under the same restaurant_id and
-- inventory_item_id. Soft CHECKs on current main only require
-- event_type = 'correction' when a supersedes id is present. The FK is a bare
-- references inventory_events(id) without restaurant or item identity.
--
-- Direct service_role inserts that satisfy those soft CHECKs can therefore
-- stamp supersedes_event_id onto an event for a different inventory item
-- inside the same restaurant, or onto an event that belongs to another
-- restaurant. Projection then applies the forged correction delta under the
-- wrong item while Activity / waste-repair analysis treat the foreign id as
-- durable repair evidence.
--
-- This migration fails closed at the database boundary for every insert path.
-- Soft correction/supersedes CHECKs and the existing id FK stay in place.
-- Does not rewrite record_inventory_event. Does not require supersedes to be
-- present (orphan corrections remain a separate tip). History is never
-- rewritten.
--
-- Cross-row identity cannot be expressed as a table CHECK, so enforcement is
-- the BEFORE INSERT trigger only (same shape as purchase-line supersede /
-- credits_line_id target tips).
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_inventory_correction_supersede_target_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.inventory_events%rowtype;
begin
  if new.supersedes_event_id is null then
    return new;
  end if;

  select * into target
  from public.inventory_events original
  where original.id = new.supersedes_event_id;

  if not found then
    raise exception
      'Superseded event not found for inventory item'
      using errcode = 'P0002';
  end if;

  if target.restaurant_id is distinct from new.restaurant_id then
    raise exception
      'Inventory correction must supersede an event in the same restaurant'
      using errcode = '22023';
  end if;

  if target.inventory_item_id is distinct from new.inventory_item_id then
    raise exception
      'Inventory correction must supersede an event for the same inventory item'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_events_correction_supersede_target_evidence
  on public.inventory_events;
create trigger inventory_events_correction_supersede_target_evidence
before insert on public.inventory_events
for each row execute function private.enforce_inventory_correction_supersede_target_evidence();

revoke all on function private.enforce_inventory_correction_supersede_target_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_inventory_correction_supersede_target_evidence() is
  'Fail closed: supersedes_event_id must name a same-restaurant, same-inventory-item event.';
