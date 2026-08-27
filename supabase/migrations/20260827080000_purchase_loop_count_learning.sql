-- Feed bounded purchase-loop count-variance samples into the operational
-- planning snapshot so Edge signal refresh can pad recommendations for chronic
-- post-receive undercounts without inventing quantities or new business tables.

create index if not exists action_outcomes_restaurant_measured_lookup_idx
  on public.action_outcomes (restaurant_id, measured_at desc);

create or replace function private.purchase_loop_count_history_json(
  p_restaurant_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(sample order by sample->>'measuredAt' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'inventoryItemId', line.inventory_item_id,
      'systemQuantityAtStart', line.system_quantity_at_start,
      'countedQuantity', line.counted_quantity,
      'varianceFromSystem', line.variance_from_system,
      'measuredAt', outcome.measured_at,
      'countSessionId', outcome.actual_result->>'countSessionId',
      'supplierOrderId', nullif(line.supplier_order_id, '')
    ) as sample
    from public.action_outcomes outcome
    cross join lateral (
      select
        nullif(trim(coalesce(entry->>'inventoryItemId', '')), '') as inventory_item_id,
        nullif(entry->>'systemQuantityAtStart', '')::numeric as system_quantity_at_start,
        nullif(entry->>'countedQuantity', '')::numeric as counted_quantity,
        coalesce(
          nullif(entry->>'varianceFromSystem', '')::numeric,
          nullif(entry->>'countedQuantity', '')::numeric
            - nullif(entry->>'systemQuantityAtStart', '')::numeric
        ) as variance_from_system,
        nullif(trim(coalesce(entry->>'supplierOrderId', '')), '') as supplier_order_id
      from jsonb_array_elements(
        case
          when jsonb_typeof(outcome.actual_result->'lines') = 'array'
            then outcome.actual_result->'lines'
          else '[]'::jsonb
        end
      ) as entry
    ) line
    where outcome.restaurant_id = p_restaurant_id
      and outcome.actual_result->>'evidenceVersion' = 'mise.purchase_loop_outcome.v1'
      and outcome.actual_result->>'phase' = 'count'
      and line.inventory_item_id is not null
      and line.system_quantity_at_start is not null
      and line.system_quantity_at_start > 0
      and line.counted_quantity is not null
      and line.counted_quantity >= 0
    order by outcome.measured_at desc, outcome.id, line.inventory_item_id
    limit 500
  ) count_history;
$$;

revoke all on function private.purchase_loop_count_history_json(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.purchase_loop_count_history_json(uuid) to service_role;

comment on function private.purchase_loop_count_history_json(uuid) is
  'Bounded newest-first count-phase purchase-loop samples for chronic post-receive undercount advisory learning.';

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

  select timezone into restaurant_time_zone
  from public.restaurants
  where id = p_restaurant_id;
  begin
    operating_date := (now() at time zone coalesce(restaurant_time_zone, 'UTC'))::date;
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
    'providerMappings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurantId', mapping.restaurant_id,
        'sourcePos', integration.provider,
        'providerLocationId', location.external_location_id,
        'externalCatalogItemId', mapping.external_catalog_item_id,
        'externalVariationId', mapping.external_variation_id,
        'menuItemId', mapping.menu_item_id
      ) order by mapping.id)
      from public.pos_catalog_item_mappings mapping
      join public.pos_locations location
        on location.restaurant_id = mapping.restaurant_id and location.id = mapping.pos_location_id
      join public.pos_integrations integration
        on integration.restaurant_id = location.restaurant_id and integration.id = location.pos_integration_id
      join public.menu_items menu_item
        on menu_item.restaurant_id = mapping.restaurant_id and menu_item.id = mapping.menu_item_id
      where mapping.restaurant_id = p_restaurant_id
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= clock_timestamp()
        and (mapping.effective_to is null or mapping.effective_to > clock_timestamp())
        and location.status = 'active'
        and integration.status = 'connected'
        and menu_item.active
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
    'purchaseLoopCountHistory', private.purchase_loop_count_history_json(p_restaurant_id),
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
            and event.effective_at <= clock_timestamp() + interval '2 minutes'
          order by event.inventory_item_id, event.effective_at desc, event.sequence desc
        )
        union
        (
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
  'Tenant-scoped planning snapshot. Carries verified count evidence, provider mappings, restaurant timezone, and purchaseLoopCountHistory for bounded post-receive undercount advisory learning.';

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
