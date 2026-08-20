-- MISE-002A: provider display names are not planning identity. A provider sale
-- may deplete a recipe only through a current verified catalog mapping to a
-- tenant-scoped menu item, then an explicitly linked recipe ingredient.

alter table public.pos_sales
  add column if not exists provider_catalog_item_id text,
  add column if not exists provider_location_id text,
  add column if not exists provider_variation_id text;

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_catalog_item_id_check;
alter table public.pos_sales
  add constraint pos_sales_provider_catalog_item_id_check
    check (
      provider_catalog_item_id is null
      or (
        length(provider_catalog_item_id) between 1 and 128
        and provider_catalog_item_id !~ '[[:cntrl:]]'
      )
    );

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_location_id_check;
alter table public.pos_sales
  add constraint pos_sales_provider_location_id_check
    check (
      provider_location_id is null
      or (
        length(provider_location_id) between 1 and 128
        and provider_location_id !~ '[[:cntrl:]]'
      )
    );

alter table public.pos_sales
  drop constraint if exists pos_sales_provider_variation_id_check;
alter table public.pos_sales
  add constraint pos_sales_provider_variation_id_check
    check (
      provider_variation_id is null
      or (
        length(provider_variation_id) between 1 and 128
        and provider_variation_id !~ '[[:cntrl:]]'
      )
    );

create index if not exists pos_sales_provider_identity_idx
  on public.pos_sales (restaurant_id, source_pos, provider_variation_id)
  where provider_variation_id is not null;

alter table public.menu_item_ingredients
  add column if not exists menu_item_id uuid;

update public.menu_item_ingredients mapping
set menu_item_id = item.id
from public.menu_items item
where mapping.menu_item_id is null
  and mapping.restaurant_id = item.restaurant_id
  and lower(trim(mapping.menu_item_name)) = lower(trim(item.name));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_item_ingredients_menu_item_tenant_fkey'
      and conrelid = 'public.menu_item_ingredients'::regclass
  ) then
    alter table public.menu_item_ingredients
      add constraint menu_item_ingredients_menu_item_tenant_fkey
      foreign key (restaurant_id, menu_item_id)
      references public.menu_items (restaurant_id, id)
      on delete restrict;
  end if;
end $$;

comment on column public.pos_sales.provider_catalog_item_id is
  'Provider catalog item identity. Display names remain non-authoritative hints.';
comment on column public.pos_sales.provider_location_id is
  'Provider location identity for sale replay and verified mapping resolution.';
comment on column public.pos_sales.provider_variation_id is
  'Provider variation/object identity carried by the sale line. Required for provider recipe depletion.';
comment on column public.menu_item_ingredients.menu_item_id is
  'Explicit tenant-scoped menu identity for authoritative provider recipe consumption. Legacy name-only rows remain manual/non-provider only.';

create or replace function private.assign_recipe_menu_item_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.menu_item_id is not null then
    return new;
  end if;

  select item.id into new.menu_item_id
  from public.menu_items item
  where item.restaurant_id = new.restaurant_id
    and lower(trim(item.name)) = lower(trim(new.menu_item_name))
  limit 1;

  if new.menu_item_id is null then
    insert into public.menu_items (restaurant_id, name, active)
    values (new.restaurant_id, trim(new.menu_item_name), true)
    returning id into new.menu_item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_recipe_menu_item_identity on public.menu_item_ingredients;
create trigger assign_recipe_menu_item_identity
before insert or update of restaurant_id, menu_item_name, menu_item_id on public.menu_item_ingredients
for each row execute function private.assign_recipe_menu_item_identity();

revoke all on function private.assign_recipe_menu_item_identity()
  from public, anon, authenticated, service_role;

/*
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
    'inventoryLedgerEvents', coalesce((
      with anchor as (
        select distinct on (event.inventory_item_id) event.*
        from public.inventory_events event
        where event.restaurant_id = p_restaurant_id
          and event.event_type = 'count'
        order by event.inventory_item_id, event.sequence desc
      ),
      valid_counts as (
        select distinct on (event.inventory_item_id) event.*
        from public.inventory_events event
        where event.restaurant_id = p_restaurant_id
          and event.event_type = 'count'
          and event.effective_at <= clock_timestamp() + interval '2 minutes'
        order by event.inventory_item_id, event.effective_at desc, event.sequence desc
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', newest_count.id,
          'restaurantId', newest_count.restaurant_id,
          'inventoryItemId', newest_count.inventory_item_id,
          'eventType', newest_count.event_type,
          'effectiveAt', newest_count.effective_at,
          )
          'quantity', newest_count.quantity,
          'canonicalUnit', newest_count.canonical_unit
        )
        order by newest_count.inventory_item_id, newest_count.sequence
      )
        'Tenant-scoped planning snapshot. Carries the newest valid verified inventory count per item, the newest count actually applied to the projection, any row applied out of order across that count boundary, provider mappings, and the restaurant timezone, so projected on-hand is anchored to physical count time rather than inventory_items.last_updated and a tainted projection is detectable.';
        (select * from anchor)
        union
        (select * from valid_counts)
      ) newest_count
    ), '[]'::jsonb),
    'ledgerComplete', true
  );
end;
$$;

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;

*/
create or replace function private.service_apply_square_sync_result(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale jsonb;
  catalog_item jsonb;
  import_id uuid := gen_random_uuid();
  processed_count integer := 0;
  catalog_processed integer := 0;
  resolved_menu_item_id uuid;
  location_id uuid;
  catalog_external_name text;
  catalog_item_external_id text;
  catalog_variation_id text;
  updated_mapping_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array'
    or p_catalog_items is null or jsonb_typeof(p_catalog_items) <> 'array'
    or p_from is null or p_to is null or p_to < p_from
  then
    raise exception 'Square sync payload is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pos_integrations integration
    where integration.id = p_integration_id
      and integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square'
  ) then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'processing',
    0, jsonb_build_object('provider', 'square', 'from', p_from, 'to', p_to), now()
  );

  for sale in select value from jsonb_array_elements(p_sales)
  loop
    if coalesce(sale->>'source_record_id', '') = ''
      or coalesce(sale->>'item_name', '') = ''
      or coalesce(sale->>'sale_date', '') = ''
    then
      continue;
    end if;
    insert into public.pos_sales (
      restaurant_id, sale_date, item_name, category, quantity_sold,
      gross_sales, net_sales, source_pos, source_record_id,
      provider_location_id, provider_catalog_item_id, provider_variation_id
    ) values (
      p_restaurant_id,
      (sale->>'sale_date')::date,
      left(sale->>'item_name', 160),
      left(coalesce(sale->>'category', 'Square'), 80),
      least(100000::numeric, greatest(0.0001::numeric, (sale->>'quantity_sold')::numeric)),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'gross_sales')::numeric, 0))),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'net_sales')::numeric, 0))),
      'Square',
      left(sale->>'source_record_id', 200),
      nullif(left(trim(coalesce(sale->>'provider_location_id', '')), 128), ''),
      nullif(left(trim(coalesce(sale->>'provider_catalog_item_id', '')), 128), ''),
      nullif(left(trim(coalesce(sale->>'provider_variation_id', '')), 128), '')
    )
    on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set
      sale_date = excluded.sale_date,
      item_name = excluded.item_name,
      category = excluded.category,
      quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales,
      net_sales = excluded.net_sales,
      provider_location_id = excluded.provider_location_id,
      provider_catalog_item_id = excluded.provider_catalog_item_id,
      provider_variation_id = excluded.provider_variation_id;
    processed_count := processed_count + 1;
  end loop;

  select location.id into location_id
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active'
  order by location.created_at
  limit 1;

  for catalog_item in select value from jsonb_array_elements(p_catalog_items)
  loop
    resolved_menu_item_id := null;
    updated_mapping_id := null;
    catalog_external_name := left(trim(coalesce(catalog_item->>'external_name', '')), 160);
    catalog_item_external_id := left(coalesce(catalog_item->>'external_catalog_item_id', ''), 128);
    catalog_variation_id := left(coalesce(catalog_item->>'external_variation_id', ''), 128);
    if catalog_external_name = '' or catalog_item_external_id = '' then
      continue;
    end if;

    select item.id into resolved_menu_item_id
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
      and lower(trim(item.name)) = lower(trim(catalog_external_name))
    limit 1;

    if resolved_menu_item_id is null then
      insert into public.menu_items (restaurant_id, name, category, active)
      values (
        p_restaurant_id,
        catalog_external_name,
        left(coalesce(catalog_item->>'category', 'Square'), 80),
        true
      )
      returning id into resolved_menu_item_id;
    else
      update public.menu_items
      set category = left(coalesce(catalog_item->>'category', 'Square'), 80),
        active = true,
        updated_at = now()
      where id = resolved_menu_item_id and restaurant_id = p_restaurant_id;
    end if;

    if location_id is not null and resolved_menu_item_id is not null then
      update public.pos_catalog_item_mappings mapping
      set external_name = catalog_external_name,
        menu_item_id = case when mapping.verification_status = 'verified' then mapping.menu_item_id else resolved_menu_item_id end,
        updated_at = now()
      where mapping.restaurant_id = p_restaurant_id
        and mapping.pos_location_id = location_id
        and mapping.external_catalog_item_id = catalog_item_external_id
        and mapping.external_variation_id = catalog_variation_id
        and mapping.effective_to is null
      returning mapping.id into updated_mapping_id;

      if updated_mapping_id is null then
        insert into public.pos_catalog_item_mappings (
          restaurant_id, pos_location_id, external_catalog_item_id, external_variation_id,
          external_name, menu_item_id, verification_status, confidence
        ) values (
          p_restaurant_id, location_id, catalog_item_external_id, catalog_variation_id,
          catalog_external_name, resolved_menu_item_id, 'draft', 0
        );
      end if;
      catalog_processed := catalog_processed + 1;
    end if;
  end loop;

  update public.sales_imports
  set status = 'completed',
    records_processed = processed_count,
    metadata = jsonb_build_object(
      'provider', 'square', 'from', p_from, 'to', p_to, 'catalog_processed', catalog_processed
    ),
    imported_at = now()
  where id = import_id;

  update public.pos_integrations
  set status = 'connected',
    last_sync_at = now(),
    sync_cursor = nullif(left(coalesce(p_sync_cursor, ''), 500), ''),
    updated_at = now()
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_sync_completed', 'sales_imports', import_id,
    jsonb_build_object('provider', 'square', 'records_processed', processed_count, 'catalog_processed', catalog_processed)
  );

  return jsonb_build_object(
    'importId', import_id,
    'recordsProcessed', processed_count,
    'catalogProcessed', catalog_processed,
    'status', 'completed'
  );
end;
$$;

create or replace function public.service_apply_square_sync_result(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_apply_square_sync_result(
    p_actor_user_id, p_restaurant_id, p_integration_id,
    p_sales, p_catalog_items, p_sync_cursor, p_from, p_to
  );
$$;

revoke all on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
grant execute on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;
grant execute on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;
