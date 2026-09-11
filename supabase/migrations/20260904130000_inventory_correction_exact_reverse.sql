-- Inventory corrections must exactly reverse the superseded ledger movement.
--
-- Product writers (#345 waste correction, #350 receipt correction) already stamp
-- the restoring or removing quantity. Hosted record_inventory_event still accepted
-- any signed delta when supersedes_event_id was set, so a manager JWT could
-- "correct" a 50 g waste with +5000 g (or -50 g) and rewrite on-hand under false
-- repair semantics.
--
-- Correctable targets are receipt, waste, usage, adjustment, and transfer.
-- Count and stockout set absolute on-hand and cannot be undone by a signed delta;
-- correcting a correction is rejected so repair chains stay one level deep.
-- Canonical unit must match the superseded row.
--
-- A BEFORE INSERT trigger covers every write path without re-declaring
-- record_inventory_event, so this composes with sibling ledger migrations
-- (orphan supersede required, zero-quantity, future-dating, evidence bounds).
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_inventory_correction_exact_reverse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  superseded public.inventory_events;
  expected_quantity numeric;
begin
  if new.event_type <> 'correction' or new.supersedes_event_id is null then
    return new;
  end if;

  select event.*
  into superseded
  from public.inventory_events event
  where event.id = new.supersedes_event_id;

  if not found
    or superseded.restaurant_id <> new.restaurant_id
    or superseded.inventory_item_id <> new.inventory_item_id
  then
    raise exception 'Superseded event not found for inventory item'
      using errcode = '23503';
  end if;

  if superseded.canonical_unit <> new.canonical_unit then
    raise exception 'Inventory correction canonical unit must match the superseded event'
      using errcode = '22023';
  end if;

  if superseded.event_type not in (
    'receipt', 'waste', 'usage', 'adjustment', 'transfer'
  ) then
    raise exception
      'Inventory correction can only reverse receipt, waste, usage, adjustment, or transfer events'
      using errcode = '22023';
  end if;

  expected_quantity := case
    when superseded.event_type in ('receipt', 'adjustment', 'transfer')
      then -superseded.quantity
    else superseded.quantity
  end;

  if new.quantity is distinct from expected_quantity then
    raise exception 'Inventory correction quantity must exactly reverse the superseded event'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_inventory_correction_exact_reverse()
  from public, anon, authenticated, service_role;

drop trigger if exists inventory_events_correction_exact_reverse
  on public.inventory_events;

create trigger inventory_events_correction_exact_reverse
  before insert on public.inventory_events
  for each row
  execute function private.enforce_inventory_correction_exact_reverse();

comment on function private.enforce_inventory_correction_exact_reverse() is
  'Fail closed: inventory_events correction rows must use the exact reverse quantity and unit of a correctable superseded movement.';
