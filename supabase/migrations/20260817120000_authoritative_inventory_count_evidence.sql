-- MISE-001: make inventory evidence temporally authoritative.
--
-- `inventory_items.last_updated` moves for par/reorder policy edits, supplier
-- changes, and cost changes, so it is not proof that a physical count happened.
-- The append-only ledger row `inventory_events (event_type = 'count')` is.
--
-- The Edge planning path recomputes recommendations and insights from
-- `private.fetch_operational_planning_snapshot`, so that snapshot must carry the
-- newest verified count per item plus the restaurant timezone. Without them the
-- server-side depletion window cannot be anchored to count time and a midday
-- count would be reduced again by the morning's day-resolution POS sales.
--
-- This is a read-only, additive change to an existing security-definer function.
-- The signature, the owner/admin/manager role gate, `search_path = ''`, tenant
-- scoping, and all existing grants and revokes are unchanged. No table, policy,
-- privilege, or RLS change is introduced.

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
    -- Up to two count rows per inventory item, so the domain can judge both the
    -- authoritative baseline and whether the materialized projection is trustworthy.
    -- Count sessions are capped at 250 items, so this stays bounded.
    --
    --   1. The newest count by ledger SEQUENCE. `apply_inventory_event_projection`
    --      applies events in insertion order and a count REPLACES
    --      inventory_items.current_quantity, so this row is what the materialized
    --      quantity was last anchored by. It is returned even when future-dated:
    --      hiding it would hide the contamination it caused.
    --   2. The newest VALID count by effective time, which is the authoritative
    --      baseline. Future-dated rows are excluded here, so a count effective after
    --      now can never be reported as fresh evidence or hide the latest valid count.
    --
    -- The two-minute bound is the device/server clock-skew tolerance shared with
    -- COUNT_CLOCK_SKEW_TOLERANCE_MS in services/domain/inventoryCountAuthority.ts and
    -- with the reject_future_dated_inventory_count ledger trigger.
    'inventoryCountEvents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', newest_count.id,
          'restaurantId', newest_count.restaurant_id,
          'inventoryItemId', newest_count.inventory_item_id,
          'eventType', newest_count.event_type,
          'effectiveAt', newest_count.effective_at,
          'sequence', newest_count.sequence,
          'quantity', newest_count.quantity,
          'canonicalUnit', newest_count.canonical_unit
        )
        order by newest_count.inventory_item_id, newest_count.sequence
      )
      from (
        (
          select distinct on (event.inventory_item_id) event.*
          from public.inventory_events event
          where event.restaurant_id = p_restaurant_id
            and event.event_type = 'count'
          order by event.inventory_item_id, event.sequence desc
        )
        union
        (
          select distinct on (event.inventory_item_id) event.*
          from public.inventory_events event
          where event.restaurant_id = p_restaurant_id
            and event.event_type = 'count'
            and event.effective_at <= now() + interval '2 minutes'
          order by event.inventory_item_id, event.effective_at desc, event.sequence desc
        )
      ) newest_count
    ), '[]'::jsonb)
  );
end;
$$;

comment on function private.fetch_operational_planning_snapshot(uuid, uuid) is
  'Tenant-scoped planning snapshot. Carries the newest valid verified inventory count per item, the newest count actually applied to the projection, and the restaurant timezone, so projected on-hand is anchored to physical count time rather than inventory_items.last_updated and a tainted projection is detectable.';
