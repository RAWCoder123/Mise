-- Apply mapped recipe consumption when manual CSV POS sales are ingested.
-- Deducts inventory through the append-only ledger with source_record_id idempotency.

create or replace function private.canonical_inventory_unit(p_unit text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case replace(lower(trim(coalesce(p_unit, ''))), ' ', '')
    when 'lb' then 'lb'
    when 'lbs' then 'lb'
    when 'pound' then 'lb'
    when 'pounds' then 'lb'
    when 'oz' then 'oz'
    when 'ounce' then 'oz'
    when 'ounces' then 'oz'
    when 'kg' then 'kg'
    when 'kgs' then 'kg'
    when 'kilogram' then 'kg'
    when 'kilograms' then 'kg'
    when 'g' then 'g'
    when 'gram' then 'g'
    when 'grams' then 'g'
    when 'ml' then 'ml'
    when 'milliliter' then 'ml'
    when 'milliliters' then 'ml'
    when 'millilitre' then 'ml'
    when 'millilitres' then 'ml'
    when 'l' then 'l'
    when 'liter' then 'l'
    when 'liters' then 'l'
    when 'litre' then 'l'
    when 'litres' then 'l'
    when 'ea' then 'each'
    when 'each' then 'each'
    when 'unit' then 'each'
    when 'units' then 'each'
    when 'case' then 'case'
    when 'cases' then 'case'
    when 'pack' then 'pack'
    when 'packs' then 'pack'
    when 'head' then 'head'
    when 'heads' then 'head'
    else lower(trim(coalesce(p_unit, '')))
  end;
$$;

create or replace function private.inventory_units_are_compatible(p_inventory_unit text, p_recipe_unit text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    length(private.canonical_inventory_unit(p_inventory_unit)) > 0
    and private.canonical_inventory_unit(p_inventory_unit) = private.canonical_inventory_unit(p_recipe_unit);
$$;

create unique index if not exists inventory_movements_recipe_consumption_source_uidx
  on public.inventory_movements (
    restaurant_id,
    inventory_item_id,
    ((metadata->>'source_record_id'))
  )
  where reason in ('recipe_consumption', 'pos_consumption')
    and coalesce(metadata->>'source_record_id', '') <> '';

create or replace function private.apply_recipe_consumption_for_sales(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_source_record_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale_row public.pos_sales%rowtype;
  mapping_row public.menu_item_ingredients%rowtype;
  item_row public.inventory_items%rowtype;
  quantity_used numeric;
  quantity_before numeric;
  quantity_after numeric;
  movements_written integer := 0;
  unmapped_sale_count integer := 0;
  matched_compatible boolean;
  source_ids text[] := coalesce(p_source_record_ids, array[]::text[]);
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  for sale_row in
    select *
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and sale.source_record_id = any(source_ids)
    order by sale.sale_date, sale.id
    for update
  loop
    matched_compatible := false;
    for mapping_row in
      select *
      from public.menu_item_ingredients mapping
      where mapping.restaurant_id = p_restaurant_id
        and lower(regexp_replace(trim(mapping.menu_item_name), '\s+', ' ', 'g'))
          = lower(regexp_replace(trim(sale_row.item_name), '\s+', ' ', 'g'))
    loop
      select * into item_row
      from public.inventory_items item
      where item.restaurant_id = p_restaurant_id
        and item.id = mapping_row.inventory_item_id
      for update;
      if not found then
        continue;
      end if;
      if not private.inventory_units_are_compatible(item_row.unit, mapping_row.unit) then
        continue;
      end if;

      quantity_used := round(
        greatest(0, coalesce(sale_row.quantity_sold, 0))
        * greatest(0, coalesce(mapping_row.quantity_used_per_sale, 0))
      , 4);
      if quantity_used <= 0 then
        continue;
      end if;

      if exists (
        select 1
        from public.inventory_movements movement
        where movement.restaurant_id = p_restaurant_id
          and movement.inventory_item_id = item_row.id
          and movement.reason in ('recipe_consumption', 'pos_consumption')
          and movement.metadata->>'source_record_id' = sale_row.source_record_id
      ) then
        matched_compatible := true;
        continue;
      end if;

      quantity_before := item_row.current_quantity;
      quantity_after := greatest(0, round(quantity_before - quantity_used, 4));
      update public.inventory_items
      set current_quantity = quantity_after,
          last_updated = clock_timestamp()
      where restaurant_id = p_restaurant_id
        and id = item_row.id;

      insert into public.inventory_movements (
        restaurant_id,
        inventory_item_id,
        actor_user_id,
        reason,
        quantity_before,
        quantity_after,
        source_workflow,
        metadata
      ) values (
        p_restaurant_id,
        item_row.id,
        p_actor_user_id,
        'recipe_consumption',
        quantity_before,
        quantity_after,
        'manual_pos_csv_ingest',
        jsonb_build_object(
          'source_record_id', sale_row.source_record_id,
          'pos_sale_id', sale_row.id,
          'menu_item_name', sale_row.item_name,
          'mapping_id', mapping_row.id,
          'sale_date', sale_row.sale_date,
          'quantity_used', quantity_used
        )
      );
      movements_written := movements_written + 1;
      matched_compatible := true;
    end loop;

    if not matched_compatible then
      unmapped_sale_count := unmapped_sale_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'consumption_movements_written', movements_written,
    'unmapped_sale_count', unmapped_sale_count
  );
end;
$$;

create or replace function private.service_ingest_manual_pos_sales(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_sales jsonb,
  p_source_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_sales jsonb := coalesce(p_sales, '[]'::jsonb);
  sale_count integer := 0;
  payload record;
  integration_id uuid;
  import_id uuid;
  imported_at timestamptz := clock_timestamp();
  safe_file_name text := nullif(trim(coalesce(p_source_file_name, '')), '');
  source_ids text[] := array[]::text[];
  consumption jsonb := '{}'::jsonb;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if jsonb_typeof(safe_sales) <> 'array' then
    raise exception 'POS sales payload must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_sales) < 1 or jsonb_array_length(safe_sales) > 1000 then
    raise exception 'POS CSV ingest accepts between 1 and 1000 sales rows' using errcode = '22023';
  end if;
  if safe_file_name is not null and length(safe_file_name) > 240 then
    raise exception 'Source file name is too long' using errcode = '22023';
  end if;

  insert into public.pos_integrations (
    restaurant_id,
    provider,
    status,
    external_location_id,
    last_sync_at,
    sync_cursor,
    settings,
    updated_at
  ) values (
    p_restaurant_id,
    'manual_csv',
    'connected',
    null,
    imported_at,
    null,
    jsonb_build_object(
      'mode', 'manual_csv',
      'importsSales', true,
      'storesCredentials', false
    ),
    imported_at
  )
  on conflict (restaurant_id, provider) do update
  set status = 'connected',
      last_sync_at = excluded.last_sync_at,
      settings = excluded.settings,
      updated_at = excluded.updated_at
  returning id into integration_id;

  insert into public.sales_imports (
    restaurant_id,
    pos_integration_id,
    import_type,
    status,
    source_file_name,
    records_processed,
    error_message,
    metadata,
    imported_at
  ) values (
    p_restaurant_id,
    integration_id,
    'csv_upload',
    'completed',
    safe_file_name,
    0,
    null,
    jsonb_build_object(
      'source', 'manual_csv_ingest',
      'storage_status', 'rows_only',
      'raw_file_stored', false
    ),
    imported_at
  )
  returning id into import_id;

  for payload in
    select * from jsonb_to_recordset(safe_sales) as value(
      source_record_id text,
      sale_date date,
      item_name text,
      category text,
      quantity_sold numeric,
      gross_sales numeric,
      net_sales numeric,
      source_pos text
    )
  loop
    payload.source_record_id := trim(payload.source_record_id);
    payload.item_name := trim(payload.item_name);
    payload.category := trim(payload.category);
    payload.source_pos := trim(payload.source_pos);

    if length(payload.source_record_id) not between 1 and 200
       or payload.sale_date is null
       or length(payload.item_name) not between 1 and 200
       or length(payload.category) not between 1 and 120
       or payload.quantity_sold is null or payload.quantity_sold <= 0 or payload.quantity_sold > 100000
       or payload.gross_sales is null or payload.gross_sales not between 0 and 10000000
       or payload.net_sales is null or payload.net_sales not between 0 and 10000000
       or payload.source_pos <> 'Manual CSV Upload' then
      raise exception 'Invalid POS CSV ingest row' using errcode = '22023';
    end if;

    insert into public.pos_sales (
      restaurant_id, source_record_id, sale_date, item_name, category,
      quantity_sold, gross_sales, net_sales, source_pos
    ) values (
      p_restaurant_id, payload.source_record_id, payload.sale_date,
      payload.item_name, payload.category, payload.quantity_sold,
      payload.gross_sales, payload.net_sales, payload.source_pos
    )
    on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set
      sale_date = excluded.sale_date,
      item_name = excluded.item_name,
      category = excluded.category,
      quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales,
      net_sales = excluded.net_sales;
    sale_count := sale_count + 1;
    source_ids := array_append(source_ids, payload.source_record_id);
  end loop;

  update public.sales_imports
  set records_processed = sale_count
  where id = import_id
    and restaurant_id = p_restaurant_id;

  consumption := private.apply_recipe_consumption_for_sales(
    p_actor_user_id,
    p_restaurant_id,
    source_ids
  );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    p_actor_user_id,
    'manual_pos_csv_ingested',
    'sales_imports',
    import_id,
    jsonb_build_object(
      'pos_sales_rows_saved', sale_count,
      'pos_integration_id', integration_id,
      'source_file_name', safe_file_name,
      'consumption_movements_written', coalesce((consumption->>'consumption_movements_written')::integer, 0),
      'unmapped_sale_count', coalesce((consumption->>'unmapped_sale_count')::integer, 0)
    )
  );

  return jsonb_build_object(
    'pos_sales_rows_saved', sale_count,
    'sales_import_id', import_id,
    'pos_integration_id', integration_id,
    'provider', 'manual_csv',
    'consumption_movements_written', coalesce((consumption->>'consumption_movements_written')::integer, 0),
    'unmapped_sale_count', coalesce((consumption->>'unmapped_sale_count')::integer, 0)
  );
end;
$$;

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

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := current_date;
  end;

  return jsonb_build_object(
    'revision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
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
    'appliedTodayConsumptionByItemId', coalesce((
      select jsonb_object_agg(inventory_item_id::text, consumed)
      from (
        select
          movement.inventory_item_id,
          round(sum(greatest(0, movement.quantity_before - movement.quantity_after)), 4) as consumed
        from public.inventory_movements movement
        where movement.restaurant_id = p_restaurant_id
          and movement.reason in ('recipe_consumption', 'pos_consumption')
          and (movement.metadata->>'sale_date')::date = coalesce(operating_date, current_date)
        group by movement.inventory_item_id
      ) applied
    ), '{}'::jsonb)
  );
end;
$$;

revoke all on function private.canonical_inventory_unit(text) from public, anon, authenticated;
revoke all on function private.inventory_units_are_compatible(text, text) from public, anon, authenticated;
revoke all on function private.apply_recipe_consumption_for_sales(uuid, uuid, text[])
  from public, anon, authenticated;
grant execute on function private.apply_recipe_consumption_for_sales(uuid, uuid, text[])
  to service_role;

comment on function private.apply_recipe_consumption_for_sales(uuid, uuid, text[]) is
  'Service-only mapped recipe consumption for POS sales, idempotent by source_record_id.';
comment on function private.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text) is
  'Service-only bounded manual CSV POS sales ingest with recipe consumption and ledger writes.';
