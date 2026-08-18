-- MISE-001 correction 3: the on-hand projection must respect the authoritative
-- count's effective-time boundary, not just ledger insertion order.
--
-- private.apply_inventory_event_projection applied events in ledger sequence
-- (insertion) order. A `count` REPLACES inventory_items.current_quantity, but a
-- non-count row inserted afterwards still moved that value even when its
-- effective_at was at or before the count. An offline device made this reachable:
--
--   12:00  receipt +5 recorded on a device that is offline
--   13:00  verified physical count = 10   -> current_quantity = 10
--   14:00  the 12:00 receipt syncs, taking a higher ledger sequence
--          -> old trigger added +5, current_quantity became 15
--
-- The 13:00 count already observed the 12:00 receipt, so applying it again breaks
-- the MISE-001 invariant: counted quantity, plus only what occurred AFTER the count.
--
-- Rule: once an item has an authoritative (non-future) count, a row may move the
-- materialized quantity only when its effective_at is strictly after that count. The
-- event is still inserted and retained in append-only history; it simply does not
-- move the projection. Applies to receipt, waste, usage, stockout, adjustment,
-- transfer, and correction alike.
--
-- Correction semantics are unchanged: `correction` remains the only event type that
-- may set supersedes_event_id, and it remains a signed delta rather than a reversal
-- of the superseded row. Only the boundary check is new.
--
-- Counts are also protected from being clobbered out of order: a count effective
-- strictly before an existing authoritative count does not replace the quantity,
-- because the newer count is better physical evidence. A count effective at exactly
-- the same instant still replaces, so a re-count at the same instant is deterministic
-- and supersedes.
--
-- `projection_applied` records the decision on the row itself. It is required to tell
-- a row this fix deliberately did not apply (harmless) from a legacy row that the old
-- trigger already applied out of order (contaminating). It defaults to true, so every
-- pre-existing row reads as applied, which is the fail-closed interpretation. It is
-- set in a BEFORE trigger, so no UPDATE is needed and the append-only guard still
-- holds, and it is not part of record_inventory_event's idempotency comparison, so
-- replay protection is unchanged.
--
-- The two-minute allowance matches COUNT_CLOCK_SKEW_TOLERANCE_MS in
-- services/domain/inventoryCountAuthority.ts and the
-- reject_future_dated_inventory_count trigger, so a future-dated legacy row is never
-- treated as an authoritative boundary.
--
-- No history is deleted or mutated. No row is rejected that was previously accepted:
-- this only narrows which rows may move the read-optimized projection. RLS, roles,
-- grants, revokes, tenant isolation, and the existing idempotency and append-only
-- guards are untouched.

alter table public.inventory_events
  add column if not exists projection_applied boolean not null default true;

comment on column public.inventory_events.projection_applied is
  'Whether this row moved inventory_items.current_quantity. False when it was retained in history but fell at or before the authoritative count boundary. Pre-existing rows default to true.';

create or replace function private.stamp_inventory_event_projection_applied()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  count_boundary timestamptz;
begin
  -- This is the serialization point for an item's authority decision. The row
  -- lock is retained through this INSERT and its AFTER projection trigger, so
  -- a concurrent event cannot read a stale count boundary.
  perform 1
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for projection'
      using errcode = '23503';
  end if;

  -- Newest authoritative count already on the ledger for this tenant-scoped item.
  -- Future-dated rows are excluded so an invalid count is never a boundary.
  select max(prior_count.effective_at)
  into count_boundary
  from public.inventory_events prior_count
  where prior_count.restaurant_id = new.restaurant_id
    and prior_count.inventory_item_id = new.inventory_item_id
    and prior_count.event_type = 'count'
    and prior_count.effective_at <= clock_timestamp() + interval '2 minutes';

  new.projection_applied := true;
  if count_boundary is not null then
    if new.event_type = 'count' then
      -- A backdated count cannot overwrite newer physical evidence.
      if new.effective_at < count_boundary then
        new.projection_applied := false;
      end if;
    elsif new.effective_at <= count_boundary then
      -- Already inside the counted baseline. Retained in history, not projected.
      new.projection_applied := false;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_inventory_event_projection_applied on public.inventory_events;
create trigger stamp_inventory_event_projection_applied
before insert on public.inventory_events
for each row execute function private.stamp_inventory_event_projection_applied();

create or replace function private.apply_inventory_event_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_quantity numeric;
  quantity_per_unit numeric;
  native_event_quantity numeric;
  projected_quantity numeric;
begin
  -- Retained in append-only history, but outside the authoritative count window.
  if not new.projection_applied then
    return new;
  end if;

  select item.current_quantity, item.canonical_quantity_per_unit
  into prior_quantity, quantity_per_unit
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for projection'
      using errcode = '23503';
  end if;
  if quantity_per_unit is null or quantity_per_unit <= 0 then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  native_event_quantity := new.quantity / quantity_per_unit;
  projected_quantity := case
    when new.event_type = 'count' then native_event_quantity
    when new.event_type = 'stockout' then 0
    when new.event_type = 'receipt' then prior_quantity + native_event_quantity
    when new.event_type in ('waste', 'usage') then prior_quantity - native_event_quantity
    else prior_quantity + native_event_quantity
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

revoke all on function private.stamp_inventory_event_projection_applied()
  from public, anon, authenticated, service_role;

comment on function private.stamp_inventory_event_projection_applied() is
  'Decides, at insert time, whether an inventory event may move the on-hand projection. Rows effective at or before the item''s authoritative count are retained but not applied.';
comment on function private.apply_inventory_event_projection() is
  'Projects append-only inventory events into inventory_items.current_quantity, honoring projection_applied so only events effective strictly after the authoritative count move the value.';

-- Supersede the planning snapshot so the Edge path can reach the same contamination
-- verdict as the client path. It now also returns, per item, one row that was applied
-- to the projection after the count anchor while being effective at or before it: the
-- out-of-order case this migration prevents going forward, and the signal that a
-- legacy row already tainted inventory_items.current_quantity.
--
-- Rows this fix retained without applying carry projection_applied = false and are
-- excluded, so a legitimately delayed offline event does not permanently flag an item.
--
-- Read-only and additive. The signature, owner/admin/manager role gate,
-- `search_path = ''`, tenant scoping, and all grants and revokes are unchanged.

create or replace function private.fetch_operational_planning_snapshot(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  operating_date date;
  restaurant_time_zone text;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending')
  on conflict (restaurant_id) do nothing;
  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id;

  select restaurant.timezone into restaurant_time_zone
  from public.restaurants restaurant where restaurant.id = p_restaurant_id;

  begin
    select timezone(restaurant_time_zone, now())::date into operating_date;
  exception when invalid_parameter_value then
    operating_date := current_date;
  end;

  return jsonb_build_object(
    'revision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
    'timeZone', restaurant_time_zone,
    'inventoryItems', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.item_name, item.id)
      from public.inventory_items item where item.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.sale_date desc, sale.item_name, sale.id)
      from (
        select * from public.pos_sales
        where restaurant_id = p_restaurant_id
        order by sale_date desc, id
        limit 2000
      ) sale
    ), '[]'::jsonb),
    'menuItemIngredients', coalesce((
      select jsonb_agg(to_jsonb(mapping) order by mapping.menu_item_name, mapping.id)
      from public.menu_item_ingredients mapping where mapping.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'recommendationHistory', coalesce((
      select jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at desc, recommendation.id)
      from (
        select * from public.purchase_recommendations
        where restaurant_id = p_restaurant_id and status <> 'pending'
        order by created_at desc, id
        limit 500
      ) recommendation
    ), '[]'::jsonb),
    'inventoryLedgerEvents', coalesce((
      with anchor as (
        select distinct on (event.inventory_item_id)
          event.inventory_item_id,
          event.sequence as anchor_sequence,
          event.effective_at as anchor_effective_at
        from public.inventory_events event
        where event.restaurant_id = p_restaurant_id
          and event.event_type = 'count'
        order by event.inventory_item_id, event.sequence desc
      ),
      relevant as (
        (
          -- Newest count by insertion sequence: what the projection last anchored on.
          select distinct on (event.inventory_item_id) event.*
          from public.inventory_events event
          where event.restaurant_id = p_restaurant_id
            and event.event_type = 'count'
          order by event.inventory_item_id, event.sequence desc
        )
        union
        (
          -- Newest valid count by effective time: the authoritative baseline.
          select distinct on (event.inventory_item_id) event.*
          from public.inventory_events event
          where event.restaurant_id = p_restaurant_id
            and event.event_type = 'count'
            and event.effective_at <= now() + interval '2 minutes'
          order by event.inventory_item_id, event.effective_at desc, event.sequence desc
        )
        union
        (
          -- One row applied out of order across that boundary, if any exists.
          select out_of_order.*
          from anchor
          cross join lateral (
            select event.*
            from public.inventory_events event
            where event.restaurant_id = p_restaurant_id
              and event.inventory_item_id = anchor.inventory_item_id
              and event.event_type <> 'count'
              and event.projection_applied
              and event.sequence > anchor.anchor_sequence
              and event.effective_at <= anchor.anchor_effective_at
            order by event.sequence
            limit 1
          ) out_of_order
        )
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', relevant.id,
          'restaurantId', relevant.restaurant_id,
          'inventoryItemId', relevant.inventory_item_id,
          'eventType', relevant.event_type,
          'effectiveAt', relevant.effective_at,
          'sequence', relevant.sequence,
          'quantity', relevant.quantity,
          'canonicalUnit', relevant.canonical_unit,
          'projectionApplied', relevant.projection_applied
        )
        order by relevant.inventory_item_id, relevant.sequence
      )
      from relevant
    ), '[]'::jsonb)
  );
end;
$$;

comment on function private.fetch_operational_planning_snapshot(uuid, uuid) is
  'Tenant-scoped planning snapshot. Carries the newest valid verified inventory count per item, the newest count actually applied to the projection, any row applied out of order across that count boundary, and the restaurant timezone, so projected on-hand is anchored to physical count time rather than inventory_items.last_updated and a tainted projection is detectable.';
