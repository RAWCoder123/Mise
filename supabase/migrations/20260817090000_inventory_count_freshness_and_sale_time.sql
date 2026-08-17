-- Verified inventory-count freshness + POS sale event time for depletion anchoring.
--
-- `inventory_items.last_updated` is bumped by policy edits, receipts, waste, and
-- projections. Planning freshness and recommendation un-suppression must use a
-- timestamp that only moves when a physical count is verified.
--
-- Midday counts already include morning usage. Depletion must not re-subtract
-- same-day sales that occurred at or before the count. Square closed_at is now
-- persisted as pos_sales.sold_at for that window.

alter table public.inventory_items
  add column if not exists last_counted_at timestamptz;

comment on column public.inventory_items.last_counted_at is
  'Timestamp of the latest verified physical count for this item. Distinct from last_updated, which also moves for policy and non-count ledger events.';

alter table public.pos_sales
  add column if not exists sold_at timestamptz;

comment on column public.pos_sales.sold_at is
  'Provider sale/closed timestamp when known. Used to anchor same-day depletion after a verified count. Null means date-only evidence.';

update public.inventory_items item
set last_counted_at = latest.counted_at
from (
  select
    event.restaurant_id,
    event.inventory_item_id,
    max(event.effective_at) as counted_at
  from public.inventory_events event
  where event.event_type = 'count'
  group by event.restaurant_id, event.inventory_item_id
) latest
where item.restaurant_id = latest.restaurant_id
  and item.id = latest.inventory_item_id
  and item.last_counted_at is null;

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
      last_updated = clock_timestamp(),
      last_counted_at = case
        when new.event_type = 'count' then new.effective_at
        else last_counted_at
      end
  where restaurant_id = new.restaurant_id
    and id = new.inventory_item_id;

  return new;
end;
$$;

revoke all on function private.apply_inventory_event_projection()
  from public, anon, authenticated, service_role;

comment on function private.apply_inventory_event_projection() is
  'Projects append-only inventory events into current_quantity; count events also stamp last_counted_at.';

-- Stamp verified count freshness for every approved session line, including
-- zero-variance lines that intentionally skip ledger events.
create or replace function private.stamp_approved_count_session_freshness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.inventory_items item
    set
      last_counted_at = coalesce(new.approved_at, clock_timestamp()),
      last_updated = clock_timestamp()
    where item.restaurant_id = new.restaurant_id
      and exists (
        select 1
        from public.inventory_count_lines line
        where line.session_id = new.id
          and line.restaurant_id = new.restaurant_id
          and line.inventory_item_id = item.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_approved_count_session_freshness
  on public.inventory_count_sessions;
create trigger stamp_approved_count_session_freshness
after update of status on public.inventory_count_sessions
for each row execute function private.stamp_approved_count_session_freshness();

revoke all on function private.stamp_approved_count_session_freshness()
  from public, anon, authenticated, service_role;

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

    sale_sold_at := null;
    begin
      if coalesce(sale->>'sold_at', '') <> '' then
        sale_sold_at := (sale->>'sold_at')::timestamptz;
      end if;
    exception
      when others then
        sale_sold_at := null;
    end;

    insert into public.pos_sales (
      restaurant_id, sale_date, item_name, category, quantity_sold,
      gross_sales, net_sales, source_pos, source_record_id, sold_at
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
        menu_item_id = resolved_menu_item_id,
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
          p_restaurant_id,
          location_id,
          catalog_item_external_id,
          catalog_variation_id,
          catalog_external_name,
          resolved_menu_item_id,
          'draft',
          0
        );
      end if;
      catalog_processed := catalog_processed + 1;
      updated_mapping_id := null;
    end if;
  end loop;

  update public.sales_imports
  set status = 'completed',
    records_processed = processed_count,
    metadata = jsonb_build_object(
      'provider', 'square',
      'from', p_from,
      'to', p_to,
      'catalog_processed', catalog_processed
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
    p_restaurant_id, p_actor_user_id, 'square_sync_completed',
    'sales_imports', import_id,
    jsonb_build_object(
      'provider', 'square',
      'records_processed', processed_count,
      'catalog_processed', catalog_processed
    )
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
