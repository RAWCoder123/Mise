-- Supplier delivery schedule: which weekdays a supplier delivers, and the local
-- order cutoff (minutes from midnight) for catching that truck. Empty delivery
-- days and a null cutoff preserve prior recommendation behavior. Weekdays use
-- 0=Sunday … 6=Saturday to match JavaScript Date weekday numbering.

alter table public.suppliers
  add column if not exists delivery_days smallint[] not null default '{}'::smallint[],
  add column if not exists order_cutoff_minutes smallint;

do $$
begin
  alter table public.suppliers
    drop constraint if exists suppliers_delivery_days_check;
  alter table public.suppliers
    add constraint suppliers_delivery_days_check
    check (delivery_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

  alter table public.suppliers
    drop constraint if exists suppliers_order_cutoff_minutes_check;
  alter table public.suppliers
    add constraint suppliers_order_cutoff_minutes_check
    check (
      order_cutoff_minutes is null
      or order_cutoff_minutes between 0 and 1439
    );
end;
$$;

comment on column public.suppliers.delivery_days is
  'Weekdays the supplier delivers. 0=Sunday … 6=Saturday. Empty means unknown schedule.';
comment on column public.suppliers.order_cutoff_minutes is
  'Local restaurant minutes from midnight when orders must be placed to catch a same-day delivery. Null means unknown.';

create or replace function public.update_supplier_delivery_schedule(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_delivery_days smallint[],
  p_order_cutoff_minutes integer
)
returns public.suppliers
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  supplier_row public.suppliers%rowtype;
  previous_days smallint[];
  previous_cutoff smallint;
  normalized_days smallint[] := '{}'::smallint[];
  candidate_day smallint;
  normalized_cutoff smallint;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_delivery_days is null then
    raise exception 'Delivery days must be provided' using errcode = '22023';
  end if;

  for candidate_day in
    select distinct day_value
    from unnest(p_delivery_days) as day_value
    order by day_value
  loop
    if candidate_day is null or candidate_day < 0 or candidate_day > 6 then
      raise exception 'Delivery days must be integers between 0 and 6'
        using errcode = '22023';
    end if;
    normalized_days := array_append(normalized_days, candidate_day);
  end loop;

  if p_order_cutoff_minutes is null then
    normalized_cutoff := null;
  else
    if p_order_cutoff_minutes < 0 or p_order_cutoff_minutes > 1439 then
      raise exception 'Order cutoff must be between 0 and 1439 minutes'
        using errcode = '22023';
    end if;
    normalized_cutoff := p_order_cutoff_minutes::smallint;
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, p_supplier_id);
  select * into supplier_row from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  for update;
  if not found then
    raise exception 'Supplier not found' using errcode = 'P0002';
  end if;

  previous_days := supplier_row.delivery_days;
  previous_cutoff := supplier_row.order_cutoff_minutes;
  if previous_days is not distinct from normalized_days
    and previous_cutoff is not distinct from normalized_cutoff
  then
    return supplier_row;
  end if;

  update public.suppliers supplier
  set delivery_days = normalized_days,
    order_cutoff_minutes = normalized_cutoff
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  returning * into supplier_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'supplier_delivery_schedule_updated',
    'suppliers',
    p_supplier_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', p_supplier_id,
      'previous_delivery_days', to_jsonb(previous_days),
      'delivery_days', to_jsonb(normalized_days),
      'previous_order_cutoff_minutes', previous_cutoff,
      'order_cutoff_minutes', normalized_cutoff
    )
  );

  return supplier_row;
end;
$$;

revoke all on function public.update_supplier_delivery_schedule(uuid, uuid, smallint[], integer)
from public, anon, authenticated, service_role;
grant execute on function public.update_supplier_delivery_schedule(uuid, uuid, smallint[], integer)
to authenticated;

comment on function public.update_supplier_delivery_schedule(uuid, uuid, smallint[], integer) is
  'Manager-owned supplier delivery days and local order cutoff. Does not change display name, recipient, or send content.';

-- Carry supplier schedules into the planning snapshot so Edge signal refresh can
-- raise coverage risk when stock will not survive until the next delivery.
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
    'supplierSchedules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'supplierId', supplier.id,
        'deliveryDays', to_jsonb(supplier.delivery_days),
        'orderCutoffMinutes', supplier.order_cutoff_minutes
      ) order by supplier.display_name, supplier.id)
      from public.suppliers supplier
      where supplier.restaurant_id = p_restaurant_id
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
  'Tenant-scoped planning snapshot. Carries inventory counts, provider mappings, supplier delivery schedules, and the restaurant timezone so projected coverage can respect the next delivery window.';

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
