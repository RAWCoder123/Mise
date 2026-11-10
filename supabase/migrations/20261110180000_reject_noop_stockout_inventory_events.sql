-- Reject stockout ledger rows that would not change on-hand.
--
-- Stockout events always post quantity = 0 and project current_quantity to 0.
-- When the locked inventory item is already at native zero, appending another
-- stockout only pollutes the append-only ledger and wastes idempotency keys.
--
-- A BEFORE INSERT trigger is used rather than re-declaring record_inventory_event
-- so this tip stays alone-OK beside tips that rewrite that RPC. Every write path
-- that inserts into inventory_events is covered: the manager RPC, count-session
-- approval, and the device outbox flush.
--
-- Scope: stockout rows only. Zero-quantity counts remain valid observations.
-- Zero-quantity receipt/waste/usage/adjustment rejection is a separate tip.
--
-- Preserves authentication, role gates, tenant isolation, RLS, grants/revokes,
-- and append-only behavior. Nothing is relaxed: this only rejects inserts that
-- were previously accepted as no-ops.

create or replace function private.reject_noop_stockout_inventory_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior_quantity numeric;
begin
  if new.event_type <> 'stockout' then
    return new;
  end if;

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

  if prior_quantity = 0 then
    raise exception 'On-hand is already zero; stockout would not change inventory'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_noop_stockout_inventory_event on public.inventory_events;
create trigger reject_noop_stockout_inventory_event
before insert on public.inventory_events
for each row execute function private.reject_noop_stockout_inventory_event();

revoke all on function private.reject_noop_stockout_inventory_event()
  from public, anon, authenticated, service_role;

comment on function private.reject_noop_stockout_inventory_event() is
  'Rejects inventory_events stockout rows when inventory_items.current_quantity is already zero, so no-op stockouts cannot pollute the append-only ledger.';
