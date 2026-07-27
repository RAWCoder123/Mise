-- Keep inventory_items.current_quantity as a read-optimized projection of the
-- append-only inventory ledger. The accepted event remains the source of truth;
-- a failed projection update rolls the event insert back atomically.

create or replace function private.apply_inventory_event_projection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior_quantity numeric;
  projected_quantity numeric;
begin
  select item.current_quantity
  into prior_quantity
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for projection'
      using errcode = '23503';
  end if;

  projected_quantity := case
    when new.event_type = 'count' then new.quantity
    when new.event_type = 'stockout' then 0
    when new.event_type = 'receipt' then prior_quantity + new.quantity
    when new.event_type in ('waste', 'usage') then prior_quantity - new.quantity
    else prior_quantity + new.quantity
  end;

  if projected_quantity is null
    or projected_quantity < 0
    or projected_quantity > 1000000
  then
    raise exception 'Inventory event would move on-hand outside supported limits'
      using errcode = '22023';
  end if;

  update public.inventory_items
  set current_quantity = projected_quantity,
      last_updated = clock_timestamp()
  where restaurant_id = new.restaurant_id
    and id = new.inventory_item_id;

  return new;
end;
$$;

revoke all on function private.apply_inventory_event_projection()
from public, anon, authenticated, service_role;

drop trigger if exists inventory_events_apply_projection
on public.inventory_events;

create trigger inventory_events_apply_projection
after insert on public.inventory_events
for each row execute function private.apply_inventory_event_projection();

comment on column public.inventory_items.current_quantity is
  'Read-optimized on-hand projection. Accepted inventory events are authoritative after the first ledger event.';

comment on function private.apply_inventory_event_projection() is
  'Atomically projects append-only inventory events into inventory_items.current_quantity and fails closed outside bounded on-hand limits.';
