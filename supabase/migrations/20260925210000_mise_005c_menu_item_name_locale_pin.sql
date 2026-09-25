-- MISE-005C: pin menu_items unique name key to one locale.
--
-- public.menu_items has carried
--   unique (restaurant_id, lower(trim(name)))
-- since the inventory ledger foundation. lower() follows database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A demonstrated that lower()
-- differs between en_US.UTF-8 and C for accented uppercase input, and that
-- COLLATE "C" alone only case-folds ASCII A-Z — so JALAPEÑO and Jalapeño
-- would become distinct keys under a naive C pin.
--
-- That expression unique index is a restore hazard: a glibc/ICU/ctype change
-- that moved the recomputed key would make pg_dump/restore abort on rows the
-- source accepted. Menu item id remains recipe/POS mapping authority; the
-- normalized name is discovery only, but discovery must still be byte-stable
-- across restores.
--
-- Accents are folded for the discovery key only, reusing
-- private.fold_purchase_line_accents from MISE-005A (same as MISE-005B
-- suppliers). Stored menu_items.name keeps operator-facing accents and case.
-- Every case change is pinned to COLLATE "C". trim/btrim (default space set)
-- is kept rather than [[:space:]] so internal whitespace and NBSP behavior
-- stay as they were on the historical unique expression.

create or replace function private.normalize_menu_item_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when canonical.trimmed is null or canonical.trimmed = '' then null
    else pg_catalog.lower(
      private.fold_purchase_line_accents(canonical.trimmed) collate "C"
    ) collate "C"
  end
  from (
    select pg_catalog.btrim(p_name) as trimmed
  ) canonical;
$$;

revoke all on function private.normalize_menu_item_name(text)
from public, anon, authenticated, service_role;

comment on function private.normalize_menu_item_name(text) is
  'Locale-stable menu item discovery key. Accent-fold then lower(... COLLATE "C"). Never a runtime recipe/POS authority fallback.';

-- Drop the ctype-dependent expression index before rewriting names so collision
-- repairs cannot fight the old key mid-migration.
drop index if exists public.menu_items_restaurant_normalized_name_key;

-- Accent-fold collisions: keep the earliest menu item name; give later rows a
-- stable visible suffix so UNIQUE(restaurant_id, normalize(name)) holds.
-- Durable menu_item id is unchanged, so recipe and POS mappings do not move.
with ranked as (
  select
    item.id,
    item.restaurant_id,
    item.name,
    row_number() over (
      partition by
        item.restaurant_id,
        private.normalize_menu_item_name(item.name)
      order by item.created_at asc, item.id asc
    ) as collision_rank
  from public.menu_items item
),
losers as (
  select ranked.id, ranked.restaurant_id, ranked.name
  from ranked
  where ranked.collision_rank > 1
)
update public.menu_items item
set name = pg_catalog.left(
  pg_catalog.btrim(losers.name) || ' · ' || pg_catalog.left(item.id::text, 8),
  160
),
updated_at = clock_timestamp()
from losers
where item.id = losers.id
  and item.restaurant_id = losers.restaurant_id;

create unique index menu_items_restaurant_normalized_name_key
  on public.menu_items (restaurant_id, private.normalize_menu_item_name(name));

-- Recipe ingredient inserts that omit menu_item_id must resolve by the same
-- locale-stable key the unique index uses.
create or replace function private.assign_recipe_menu_item_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_name text := private.normalize_menu_item_name(new.menu_item_name);
begin
  if new.menu_item_id is not null then
    return new;
  end if;

  if canonical_name is null then
    raise exception 'menu item name is required' using errcode = '22023';
  end if;

  select item.id into new.menu_item_id
  from public.menu_items item
  where item.restaurant_id = new.restaurant_id
    and private.normalize_menu_item_name(item.name) = canonical_name
  limit 1;

  if new.menu_item_id is null then
    insert into public.menu_items (restaurant_id, name, active)
    values (new.restaurant_id, pg_catalog.btrim(new.menu_item_name), true)
    returning id into new.menu_item_id;
  end if;
  return new;
end;
$$;

revoke all on function private.assign_recipe_menu_item_identity()
  from public, anon, authenticated, service_role;

-- Square catalog apply (renamed mise_003a_base) must look up by the same key.
-- Body is the MISE-003A apply with the menu-name match pinned to
-- private.normalize_menu_item_name; all other authority semantics unchanged.
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
  catalog_name_key text;
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

  -- The Edge helper supplies a fully paginated snapshot for every active
  -- location. Reconcile that exact provider scope so orders removed or voided
  -- at Square cannot survive beside a new authority-window marker.
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
    catalog_external_name := left(pg_catalog.btrim(coalesce(catalog_item->>'external_name', '')), 160);
    catalog_item_external_id := left(coalesce(catalog_item->>'external_catalog_item_id', ''), 128);
    catalog_variation_id := left(coalesce(catalog_item->>'external_variation_id', ''), 128);
    catalog_name_key := private.normalize_menu_item_name(catalog_external_name);
    if catalog_name_key is null or catalog_item_external_id = '' then continue; end if;

    select item.id into resolved_menu_item_id
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
      and private.normalize_menu_item_name(item.name) = catalog_name_key
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
) from public, anon, authenticated;
