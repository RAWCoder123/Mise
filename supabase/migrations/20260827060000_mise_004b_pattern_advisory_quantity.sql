-- MISE-004B: expose factual purchase-decision patterns on the planning snapshot
-- so hosted signal generation can apply bounded advisory quantity ratios.
-- Patterns remain evidence; approve/dismiss/send authority is unchanged.

create or replace function private.purchase_decision_patterns_json(
  p_restaurant_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active_events as (
    select event.*,
      case
        when event.decision_type = 'approve' then 'exact'
        when event.decision_type = 'dismiss' then 'dismiss'
        when event.quantity_ratio > 1 then 'upward'
        else 'downward'
      end as outcome_bucket
    from public.purchase_decision_events event
    where event.restaurant_id = p_restaurant_id
      and event.decision_type in ('approve', 'approve_with_override', 'dismiss')
      and not exists (
        select 1 from public.purchase_decision_events compensation
        where compensation.restaurant_id = event.restaurant_id
          and compensation.target_event_id = event.id
          and compensation.decision_type in ('undo', 'exclude_from_learning')
      )
  ), grouped as (
    select event.inventory_item_id, event.supplier_id, event.canonical_unit,
      event.recommendation_source,
      count(*) as sample_count,
      count(*) filter (where event.decision_type in ('approve', 'approve_with_override')) as approval_count,
      count(*) filter (where event.outcome_bucket = 'exact') as exact_approval_count,
      count(*) filter (where event.decision_type = 'approve_with_override') as override_count,
      count(*) filter (where event.outcome_bucket = 'upward') as upward_override_count,
      count(*) filter (where event.outcome_bucket = 'downward') as downward_override_count,
      count(*) filter (where event.outcome_bucket = 'dismiss') as dismissal_count,
      percentile_cont(0.5) within group (order by event.quantity_ratio)
        filter (where event.quantity_ratio is not null) as median_quantity_ratio,
      percentile_cont(0.5) within group (order by event.canonical_quantity_delta)
        filter (where event.canonical_quantity_delta is not null) as median_quantity_delta,
      count(*) filter (where event.occurred_at >= now() - interval '90 days') as recent_sample_count,
      min(event.occurred_at) as first_decision_at,
      max(event.occurred_at) as last_decision_at
    from active_events event
    group by event.inventory_item_id, event.supplier_id, event.canonical_unit,
      event.recommendation_source
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'pattern_version', 'mise.purchase_pattern.v1',
      'inventory_item_id', grouped.inventory_item_id,
      'supplier_id', grouped.supplier_id,
      'canonical_unit', grouped.canonical_unit,
      'recommendation_source', grouped.recommendation_source,
      'sample_count', grouped.sample_count,
      'approval_count', grouped.approval_count,
      'exact_approval_count', grouped.exact_approval_count,
      'override_count', grouped.override_count,
      'upward_override_count', grouped.upward_override_count,
      'downward_override_count', grouped.downward_override_count,
      'dismissal_count', grouped.dismissal_count,
      'approval_rate', grouped.approval_count::numeric / grouped.sample_count,
      'dismissal_rate', grouped.dismissal_count::numeric / grouped.sample_count,
      'median_quantity_ratio', grouped.median_quantity_ratio,
      'median_quantity_delta', grouped.median_quantity_delta,
      'recent_sample_count', grouped.recent_sample_count,
      'first_decision_at', grouped.first_decision_at,
      'last_decision_at', grouped.last_decision_at,
      'evidence_event_ids', evidence.ids,
      'eligible', grouped.sample_count >= 5,
      'evidence_strength', case
        when grouped.sample_count < 5 then 'insufficient'
        when greatest(
          grouped.exact_approval_count, grouped.upward_override_count,
          grouped.downward_override_count, grouped.dismissal_count
        )::numeric / grouped.sample_count >= 0.8 then 'established'
        else 'emerging'
      end,
      'dominant_outcome', case
        when greatest(
          grouped.exact_approval_count, grouped.upward_override_count,
          grouped.downward_override_count, grouped.dismissal_count
        )::numeric / grouped.sample_count < 0.8 then 'mixed'
        when grouped.exact_approval_count = greatest(
          grouped.exact_approval_count, grouped.upward_override_count,
          grouped.downward_override_count, grouped.dismissal_count
        ) then 'exact'
        when grouped.upward_override_count = greatest(
          grouped.exact_approval_count, grouped.upward_override_count,
          grouped.downward_override_count, grouped.dismissal_count
        ) then 'upward'
        when grouped.downward_override_count = greatest(
          grouped.exact_approval_count, grouped.upward_override_count,
          grouped.downward_override_count, grouped.dismissal_count
        ) then 'downward'
        else 'dismiss'
      end,
      'current_context', exists (
        select 1 from public.inventory_items item
        where item.restaurant_id = p_restaurant_id
          and item.id = grouped.inventory_item_id
          and item.supplier_id = grouped.supplier_id
          and item.canonical_unit = grouped.canonical_unit
          and item.canonical_unit_verification_status = 'verified'
      )
    )
    order by grouped.last_decision_at desc, grouped.inventory_item_id, grouped.supplier_id
  ), '[]'::jsonb)
  from grouped
  cross join lateral (
    select coalesce(array_agg(recent.id order by recent.occurred_at desc, recent.sequence desc), '{}'::uuid[]) as ids
    from (
      select event.id, event.occurred_at, event.sequence
      from active_events event
      where event.inventory_item_id = grouped.inventory_item_id
        and event.supplier_id = grouped.supplier_id
        and event.canonical_unit = grouped.canonical_unit
        and event.recommendation_source = grouped.recommendation_source
      order by event.occurred_at desc, event.sequence desc
      limit 20
    ) recent
  ) evidence;
$$;

revoke all on function private.purchase_decision_patterns_json(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.purchase_decision_patterns_json(uuid) to service_role;

comment on function private.purchase_decision_patterns_json(uuid) is
  'MISE-004B helper: tenant-scoped factual purchase-decision pattern aggregates for planning snapshots. Does not authorize purchases.';

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
    'purchaseDecisionPatterns', private.purchase_decision_patterns_json(p_restaurant_id),
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
  'Tenant-scoped planning snapshot. Carries verified count evidence, provider mappings, restaurant timezone, and MISE-004B purchase-decision pattern aggregates for bounded advisory quantity influence.';

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
