-- Persist provider sale/closed timestamps so midday verified counts only deplete
-- post-count POS demand. Rows without sold_at keep day-resolution fail-closed
-- behavior (same-day demand stays unattributed rather than guessed).

alter table public.pos_sales
  add column if not exists sold_at timestamptz;

comment on column public.pos_sales.sold_at is
  'Provider sale/closed timestamp when known. Anchors same-day depletion after a verified count. Null means date-only evidence.';

create index if not exists pos_sales_restaurant_sold_at_idx
  on public.pos_sales (restaurant_id, sold_at)
  where sold_at is not null;

-- Replace the MISE-003A base apply body so Square sync can store sold_at.
-- Entry points remain the scoped wrappers from later migrations.
create or replace function private.service_apply_square_sync_result_mise_003a_base(
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
  removed_count integer := 0;
  catalog_processed integer := 0;
  resolved_menu_item_id uuid;
  location_id uuid;
  catalog_external_name text;
  catalog_item_external_id text;
  catalog_variation_id text;
  updated_mapping_id uuid;
  completed_at timestamptz := clock_timestamp();
  sale_sold_at timestamptz;
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
  perform 1
  from public.pos_integrations integration
  where integration.id = p_integration_id
    and integration.restaurant_id = p_restaurant_id
    and integration.provider = 'square'
  for update;
  if not found then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'processing',
    0, jsonb_build_object('provider', 'square', 'from', p_from, 'to', p_to), completed_at
  );

  delete from public.pos_sales existing_sale
  where existing_sale.restaurant_id = p_restaurant_id
    and existing_sale.source_pos = 'Square'
    and existing_sale.sale_date between p_from and p_to
    and exists (
      select 1
      from public.pos_locations location
      where location.restaurant_id = p_restaurant_id
        and location.pos_integration_id = p_integration_id
        and location.status = 'active'
        and location.external_location_id = existing_sale.provider_location_id
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_sales) incoming_sale
      where coalesce(incoming_sale->>'source_record_id', '') <> ''
        and left(incoming_sale->>'source_record_id', 200) = existing_sale.source_record_id
    );
  get diagnostics removed_count = row_count;

  for sale in select value from jsonb_array_elements(p_sales)
  loop
    if coalesce(sale->>'source_record_id', '') = ''
      or coalesce(sale->>'item_name', '') = ''
      or coalesce(sale->>'sale_date', '') = ''
    then continue; end if;

    sale_sold_at := null;
    begin
      if coalesce(sale->>'sold_at', '') <> '' then
        sale_sold_at := (sale->>'sold_at')::timestamptz;
      end if;
    exception when others then
      sale_sold_at := null;
    end;

    insert into public.pos_sales (
      restaurant_id, sale_date, item_name, category, quantity_sold,
      gross_sales, net_sales, source_pos, source_record_id,
      provider_location_id, provider_catalog_item_id, provider_variation_id,
      sold_at
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
      nullif(left(trim(coalesce(sale->>'provider_variation_id', '')), 128), ''),
      sale_sold_at
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
      provider_variation_id = excluded.provider_variation_id,
      sold_at = coalesce(excluded.sold_at, public.pos_sales.sold_at);
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
    if catalog_external_name = '' or catalog_item_external_id = '' then continue; end if;

    select item.id into resolved_menu_item_id
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
      and lower(trim(item.name)) = lower(trim(catalog_external_name))
    limit 1;

    if resolved_menu_item_id is null then
      insert into public.menu_items (restaurant_id, name, category, active)
      values (p_restaurant_id, catalog_external_name,
        left(coalesce(catalog_item->>'category', 'Square'), 80), true)
      returning id into resolved_menu_item_id;
    else
      update public.menu_items
      set category = left(coalesce(catalog_item->>'category', 'Square'), 80),
        active = true,
        updated_at = completed_at
      where id = resolved_menu_item_id and restaurant_id = p_restaurant_id;
    end if;

    if location_id is not null and resolved_menu_item_id is not null then
      update public.pos_catalog_item_mappings mapping
      set external_name = catalog_external_name,
        menu_item_id = case when mapping.verification_status = 'verified' then mapping.menu_item_id else resolved_menu_item_id end,
        updated_at = completed_at
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
      'provider', 'square', 'from', p_from, 'to', p_to,
      'records_removed', removed_count, 'catalog_processed', catalog_processed
    ),
    imported_at = completed_at
  where id = import_id;

  update public.pos_integrations
  set status = 'connected',
    last_sync_at = completed_at,
    sync_cursor = nullif(left(coalesce(p_sync_cursor, ''), 500), ''),
    authority_window_from = p_from,
    authority_window_to = p_to,
    authority_window_completed_at = completed_at,
    updated_at = completed_at
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_sync_completed', 'sales_imports', import_id,
    jsonb_build_object(
      'provider', 'square', 'records_processed', processed_count,
      'records_removed', removed_count, 'catalog_processed', catalog_processed,
      'from', p_from, 'to', p_to
    )
  );

  return jsonb_build_object(
    'importId', import_id,
    'recordsProcessed', processed_count,
    'recordsRemoved', removed_count,
    'catalogProcessed', catalog_processed,
    'authorityWindowFrom', p_from,
    'authorityWindowTo', p_to,
    'authorityWindowCompletedAt', completed_at,
    'status', 'completed'
  );
end;
$$;

revoke all on function private.service_apply_square_sync_result_mise_003a_base(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

comment on function private.service_apply_square_sync_result_mise_003a_base(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) is
  'MISE-003A Square sync apply base. Persists optional sold_at from provider closed_at for count-anchored depletion.';

-- Planning reads must preserve today's timed sales; historical days may still
-- aggregate because demand baselines are day-resolution.
create or replace function public.fetch_planning_sales(
  p_restaurant_id uuid,
  p_service_days integer default 28
)
returns setof public.pos_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  operating_date date;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_service_days is null or p_service_days not between 7 and 60 then
    raise exception 'Service-day window must be between 7 and 60 days' using errcode = '22023';
  end if;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant
    where restaurant.id = p_restaurant_id;
  exception
    when invalid_parameter_value then operating_date := current_date;
  end;
  operating_date := coalesce(operating_date, current_date);

  return query
  with historical_service_days as (
    select distinct sale.sale_date
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and sale.sale_date < operating_date
    order by sale.sale_date desc
    limit p_service_days
  ),
  windowed_sales as (
    select *
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and (
        sale.sale_date = operating_date
        or sale.sale_date in (select day.sale_date from historical_service_days day)
      )
  ),
  provider_complete_historical as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      min(sale.source_pos) as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      null::timestamptz as sold_at
    from windowed_sales sale
    where sale.sale_date < operating_date
      and (
        lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
        or sale.provider_location_id is not null
        or sale.provider_catalog_item_id is not null
        or sale.provider_variation_id is not null
      )
      and sale.provider_location_id is not null
      and sale.provider_catalog_item_id is not null
      and sale.provider_variation_id is not null
    group by sale.sale_date, sale.source_pos, sale.provider_location_id, sale.provider_catalog_item_id, sale.provider_variation_id, sale.item_name, sale.category
  ),
  provider_today as (
    select
      sale.id,
      sale.restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sale.quantity_sold,
      sale.gross_sales,
      sale.net_sales,
      sale.source_pos,
      sale.created_at,
      sale.source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      sale.sold_at
    from windowed_sales sale
    where sale.sale_date = operating_date
      and (
        lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
        or sale.provider_location_id is not null
        or sale.provider_catalog_item_id is not null
        or sale.provider_variation_id is not null
      )
  ),
  provider_incomplete_historical as (
    select
      sale.id,
      sale.restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sale.quantity_sold,
      sale.gross_sales,
      sale.net_sales,
      sale.source_pos,
      sale.created_at,
      sale.source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      sale.sold_at
    from windowed_sales sale
    where sale.sale_date < operating_date
      and (
        lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
        or sale.provider_location_id is not null
        or sale.provider_catalog_item_id is not null
        or sale.provider_variation_id is not null
      )
      and not (
        sale.provider_location_id is not null
        and sale.provider_catalog_item_id is not null
        and sale.provider_variation_id is not null
      )
  ),
  manual_sales as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      case
        when count(distinct sale.source_pos) = 1 then min(sale.source_pos)
        else 'Mise aggregate'
      end as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      null::text as provider_catalog_item_id,
      null::text as provider_location_id,
      null::text as provider_variation_id,
      null::timestamptz as sold_at
    from windowed_sales sale
    where not (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
    group by sale.sale_date, sale.item_name, sale.category
  )
  select * from provider_complete_historical
  union all
  select * from provider_today
  union all
  select * from provider_incomplete_historical
  union all
  select * from manual_sales
  order by sale_date desc, source_pos, provider_location_id nulls last, provider_catalog_item_id nulls last, provider_variation_id nulls last, item_name, id;
end;
$$;

revoke all on function public.fetch_planning_sales(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.fetch_planning_sales(uuid, integer)
  to authenticated;

comment on function public.fetch_planning_sales(uuid, integer) is
  'Tenant-scoped planning sales. Preserves today''s timed sold_at rows; aggregates historical complete provider identity for demand baselines.';
