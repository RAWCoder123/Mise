-- Verified supplier pack quantities for recommendation rounding.
-- Clients never write supplier_items directly; this SECURITY DEFINER RPC is the
-- only authenticated mutation path for catalog pack verification. Planning
-- snapshots carry verified packs so Edge signal generation rounds orders.

create or replace function public.verify_supplier_item_pack_quantity(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_pack_quantity numeric
)
returns public.supplier_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  inventory_row public.inventory_items%rowtype;
  supplier_row public.supplier_items%rowtype;
  changed boolean := false;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_pack_quantity is null
    or p_pack_quantity <= 0
    or p_pack_quantity > 1000000
  then
    raise exception 'Pack quantity is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || 'supplier_pack_verify' || E'\x1f' || p_inventory_item_id::text,
      0
    )
  );

  select * into inventory_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  if inventory_row.supplier_id is null then
    raise exception 'Inventory item requires a durable supplier before pack verification'
      using errcode = '23502';
  end if;

  select * into supplier_row
  from public.supplier_items entry
  where entry.restaurant_id = p_restaurant_id
    and entry.inventory_item_id = p_inventory_item_id
    and entry.preferred is true
  order by entry.updated_at desc, entry.id desc
  limit 1
  for update;

  if not found then
    select * into supplier_row
    from public.supplier_items entry
    where entry.restaurant_id = p_restaurant_id
      and entry.inventory_item_id = p_inventory_item_id
    order by entry.preferred desc, entry.updated_at desc, entry.id desc
    limit 1
    for update;
  end if;

  if not found then
    select * into supplier_row
    from public.supplier_items entry
    where entry.restaurant_id = p_restaurant_id
      and entry.supplier_id is not distinct from inventory_row.supplier_id
      and pg_catalog.lower(pg_catalog.btrim(entry.item_name))
        = pg_catalog.lower(pg_catalog.btrim(inventory_row.item_name))
      and pg_catalog.lower(pg_catalog.btrim(entry.unit))
        = pg_catalog.lower(pg_catalog.btrim(inventory_row.unit))
    order by entry.preferred desc, entry.updated_at desc, entry.id desc
    limit 1
    for update;
  end if;

  if found then
    changed :=
      supplier_row.pack_quantity is distinct from p_pack_quantity
      or supplier_row.verification_status is distinct from 'verified'
      or supplier_row.inventory_item_id is distinct from p_inventory_item_id
      or supplier_row.supplier_id is distinct from inventory_row.supplier_id
      or supplier_row.supplier_name is distinct from inventory_row.supplier_name
      or supplier_row.item_name is distinct from inventory_row.item_name
      or supplier_row.unit is distinct from inventory_row.unit
      or supplier_row.preferred is distinct from true;

    update public.supplier_items entry
    set pack_quantity = p_pack_quantity,
      inventory_item_id = p_inventory_item_id,
      supplier_id = inventory_row.supplier_id,
      supplier_name = inventory_row.supplier_name,
      item_name = inventory_row.item_name,
      unit = inventory_row.unit,
      preferred = true,
      verification_status = 'verified',
      verified_at = pg_catalog.now(),
      verified_by = actor_user_id,
      updated_at = pg_catalog.now()
    where entry.id = supplier_row.id
      and entry.restaurant_id = p_restaurant_id
    returning * into supplier_row;
  else
    insert into public.supplier_items (
      restaurant_id,
      supplier_id,
      supplier_name,
      supplier_sku,
      inventory_item_id,
      item_name,
      unit,
      pack_size,
      pack_quantity,
      estimated_unit_cost,
      preferred,
      verification_status,
      verified_at,
      verified_by
    ) values (
      p_restaurant_id,
      inventory_row.supplier_id,
      inventory_row.supplier_name,
      null,
      p_inventory_item_id,
      inventory_row.item_name,
      inventory_row.unit,
      null,
      p_pack_quantity,
      inventory_row.estimated_unit_cost,
      true,
      'verified',
      pg_catalog.now(),
      actor_user_id
    )
    returning * into supplier_row;
    changed := true;
  end if;

  if changed then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      actor_user_id,
      'supplier_item.pack_quantity_verified',
      'supplier_items',
      supplier_row.id,
      pg_catalog.jsonb_build_object(
        'inventory_item_id', p_inventory_item_id,
        'supplier_id', inventory_row.supplier_id,
        'pack_quantity', p_pack_quantity
      )
    );
  end if;

  return supplier_row;
end;
$$;

comment on function public.verify_supplier_item_pack_quantity(uuid, uuid, numeric) is
  'Manager+ verification of supplier catalog pack quantity linked to an inventory item. Authenticated clients cannot write supplier_items directly.';

revoke all on function public.verify_supplier_item_pack_quantity(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.verify_supplier_item_pack_quantity(uuid, uuid, numeric)
to authenticated;

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
    'verifiedSupplierPacks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inventoryItemId', pack.inventory_item_id,
        'packQuantity', pack.pack_quantity
      ) order by pack.inventory_item_id)
      from (
        select distinct on (entry.inventory_item_id)
          entry.inventory_item_id,
          entry.pack_quantity
        from public.supplier_items entry
        where entry.restaurant_id = p_restaurant_id
          and entry.inventory_item_id is not null
          and entry.verification_status = 'verified'
          and entry.pack_quantity is not null
          and entry.pack_quantity > 0
        order by entry.inventory_item_id, entry.preferred desc, entry.updated_at desc, entry.id desc
      ) pack
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
  'Tenant-scoped planning snapshot. Carries verified inventory count evidence, provider mappings, verified supplier pack sizes for recommendation rounding, and the restaurant timezone.';

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
