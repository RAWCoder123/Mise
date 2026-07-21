-- Persist onboarding as one bounded transaction and make setup sales replay-safe.
-- Operational recommendation/insight refreshes are also exposed as one atomic
-- RPC so a client interruption cannot leave the two signal sets out of sync.

alter table public.pos_sales
  add column if not exists source_record_id text;

alter table public.pos_sales
  drop constraint if exists pos_sales_source_record_id_check;
alter table public.pos_sales
  add constraint pos_sales_source_record_id_check check (
    source_record_id is null or length(trim(source_record_id)) between 1 and 200
  );

create unique index if not exists pos_sales_source_record_once_idx
on public.pos_sales (restaurant_id, source_pos, source_record_id)
where source_record_id is not null;

create or replace function public.save_restaurant_setup(
  p_restaurant_id uuid,
  p_inventory_items jsonb default '[]'::jsonb,
  p_suppliers jsonb default '[]'::jsonb,
  p_recipe_mappings jsonb default '[]'::jsonb,
  p_pos_sales jsonb default '[]'::jsonb,
  p_attachments jsonb default '[]'::jsonb,
  p_skipped_recipe_ingredients integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_inventory jsonb := coalesce(p_inventory_items, '[]'::jsonb);
  safe_suppliers jsonb := coalesce(p_suppliers, '[]'::jsonb);
  safe_mappings jsonb := coalesce(p_recipe_mappings, '[]'::jsonb);
  safe_sales jsonb := coalesce(p_pos_sales, '[]'::jsonb);
  safe_attachments jsonb := coalesce(p_attachments, '[]'::jsonb);
  payload record;
  existing_id uuid;
  inventory_id uuid;
  setup_fingerprint text;
  supplier_count integer := 0;
  inventory_count integer := 0;
  mapping_count integer := 0;
  sale_count integer := 0;
  attachment_count integer := 0;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_skipped_recipe_ingredients is null or p_skipped_recipe_ingredients not between 0 and 1000 then
    raise exception 'Invalid skipped recipe count' using errcode = '22023';
  end if;

  if jsonb_typeof(safe_inventory) <> 'array'
     or jsonb_typeof(safe_suppliers) <> 'array'
     or jsonb_typeof(safe_mappings) <> 'array'
     or jsonb_typeof(safe_sales) <> 'array'
     or jsonb_typeof(safe_attachments) <> 'array' then
    raise exception 'Setup payloads must be JSON arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_inventory) > 250
     or jsonb_array_length(safe_suppliers) > 100
     or jsonb_array_length(safe_mappings) > 1000
     or jsonb_array_length(safe_sales) > 1000
     or jsonb_array_length(safe_attachments) > 25 then
    raise exception 'Setup payload exceeds supported limits' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || E'\x1fsetup', 0));

  -- Supplier identity is normalized by restaurant/name. Replays update the same
  -- recipient instead of creating another row when an email changes.
  for payload in
    select * from jsonb_to_recordset(safe_suppliers) as value(
      supplier_name text,
      email text
    )
  loop
    payload.supplier_name := trim(payload.supplier_name);
    payload.email := nullif(trim(payload.email), '');
    if length(payload.supplier_name) not between 1 and 160
       or (payload.email is not null and (
         length(payload.email) > 254
         or payload.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       )) then
      raise exception 'Invalid supplier setup row' using errcode = '22023';
    end if;

    existing_id := null;
    select id into existing_id
    from public.supplier_recipients
    where restaurant_id = p_restaurant_id
      and lower(trim(supplier_name)) = lower(payload.supplier_name)
    order by created_at
    limit 1
    for update;

    if existing_id is null then
      insert into public.supplier_recipients (restaurant_id, supplier_name, email)
      values (p_restaurant_id, payload.supplier_name, payload.email);
    else
      update public.supplier_recipients
      set supplier_name = payload.supplier_name,
          email = payload.email
      where restaurant_id = p_restaurant_id and id = existing_id;
    end if;
    supplier_count := supplier_count + 1;
  end loop;

  -- Inventory rows are upserted under the same restaurant-wide lock. Values are
  -- checked here as well as by table constraints so the entire call rolls back
  -- with a useful error if any row is malformed.
  for payload in
    select * from jsonb_to_recordset(safe_inventory) as value(
      item_name text,
      category text,
      unit text,
      current_quantity numeric,
      par_level numeric,
      reorder_threshold numeric,
      estimated_unit_cost numeric,
      supplier_name text
    )
  loop
    payload.item_name := trim(payload.item_name);
    payload.category := trim(payload.category);
    payload.unit := trim(payload.unit);
    payload.supplier_name := trim(payload.supplier_name);
    if length(payload.item_name) not between 1 and 160
       or length(payload.category) not between 1 and 120
       or length(payload.unit) not between 1 and 40
       or length(payload.supplier_name) not between 1 and 160
       or payload.current_quantity is null or payload.current_quantity not between 0 and 1000000
       or payload.par_level is null or payload.par_level not between 0 and 1000000
       or payload.reorder_threshold is null or payload.reorder_threshold not between 0 and 1000000
       or payload.estimated_unit_cost is null or payload.estimated_unit_cost not between 0 and 1000000 then
      raise exception 'Invalid inventory setup row' using errcode = '22023';
    end if;

    existing_id := null;
    select id into existing_id
    from public.inventory_items
    where restaurant_id = p_restaurant_id
      and lower(trim(item_name)) = lower(payload.item_name)
    order by last_updated, id
    limit 1
    for update;

    if existing_id is null then
      insert into public.inventory_items (
        restaurant_id, item_name, category, unit, current_quantity, par_level,
        reorder_threshold, estimated_unit_cost, supplier_name
      ) values (
        p_restaurant_id, payload.item_name, payload.category, payload.unit,
        payload.current_quantity, payload.par_level, payload.reorder_threshold,
        payload.estimated_unit_cost, payload.supplier_name
      );
    else
      update public.inventory_items
      set item_name = payload.item_name,
          category = payload.category,
          unit = payload.unit,
          current_quantity = payload.current_quantity,
          par_level = payload.par_level,
          reorder_threshold = payload.reorder_threshold,
          estimated_unit_cost = payload.estimated_unit_cost,
          supplier_name = payload.supplier_name,
          last_updated = now()
      where restaurant_id = p_restaurant_id and id = existing_id;
    end if;
    inventory_count := inventory_count + 1;
  end loop;

  for payload in
    select * from jsonb_to_recordset(safe_mappings) as value(
      menu_item_name text,
      inventory_item_name text,
      quantity_used_per_sale numeric,
      unit text
    )
  loop
    payload.menu_item_name := trim(payload.menu_item_name);
    payload.inventory_item_name := trim(payload.inventory_item_name);
    payload.unit := trim(payload.unit);
    if length(payload.menu_item_name) not between 1 and 200
       or length(payload.inventory_item_name) not between 1 and 160
       or length(payload.unit) not between 1 and 40
       or payload.quantity_used_per_sale is null
       or payload.quantity_used_per_sale <= 0
       or payload.quantity_used_per_sale > 10000 then
      raise exception 'Invalid recipe setup row' using errcode = '22023';
    end if;

    inventory_id := null;
    select id into inventory_id
    from public.inventory_items
    where restaurant_id = p_restaurant_id
      and lower(trim(item_name)) = lower(payload.inventory_item_name)
    order by last_updated, id
    limit 1
    for update;
    if inventory_id is null then
      raise exception 'Recipe inventory item was not persisted' using errcode = '22023';
    end if;

    existing_id := null;
    select id into existing_id
    from public.menu_item_ingredients
    where restaurant_id = p_restaurant_id
      and inventory_item_id = inventory_id
      and lower(trim(menu_item_name)) = lower(payload.menu_item_name)
    order by id
    limit 1
    for update;

    if existing_id is null then
      insert into public.menu_item_ingredients (
        restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
      ) values (
        p_restaurant_id, payload.menu_item_name, inventory_id,
        payload.quantity_used_per_sale, payload.unit
      );
    else
      update public.menu_item_ingredients
      set menu_item_name = payload.menu_item_name,
          quantity_used_per_sale = payload.quantity_used_per_sale,
          unit = payload.unit
      where restaurant_id = p_restaurant_id and id = existing_id;
    end if;
    mapping_count := mapping_count + 1;
  end loop;

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
      raise exception 'Invalid POS setup row' using errcode = '22023';
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
  end loop;

  for payload in
    select * from jsonb_to_recordset(safe_attachments) as value(
      client_reference_id text,
      kind text,
      label text,
      status text
    )
  loop
    payload.client_reference_id := trim(payload.client_reference_id);
    payload.label := trim(payload.label);
    if length(payload.client_reference_id) not between 1 and 200
       or length(payload.label) not between 1 and 240
       or payload.kind not in ('csv', 'screenshot')
       or payload.status not in ('queued', 'review_needed') then
      raise exception 'Invalid setup attachment row' using errcode = '22023';
    end if;

    existing_id := null;
    select id into existing_id
    from public.setup_attachments
    where restaurant_id = p_restaurant_id
      and metadata->>'client_reference_id' = payload.client_reference_id
    order by created_at
    limit 1
    for update;
    if existing_id is null then
      insert into public.setup_attachments (
        restaurant_id, kind, label, status, metadata, created_by
      ) values (
        p_restaurant_id, payload.kind, payload.label, payload.status,
        jsonb_build_object(
          'source', 'setup_onboarding',
          'client_reference_id', payload.client_reference_id,
          'storage_status', 'metadata_only'
        ),
        auth.uid()
      );
    else
      update public.setup_attachments
      set kind = payload.kind,
          label = payload.label,
          status = payload.status
      where restaurant_id = p_restaurant_id and id = existing_id;
    end if;
    attachment_count := attachment_count + 1;
  end loop;

  setup_fingerprint := md5(
    safe_inventory::text || safe_suppliers::text || safe_mappings::text ||
    safe_sales::text || safe_attachments::text
  );

  if not exists (
    select 1 from public.audit_logs
    where restaurant_id = p_restaurant_id
      and action = 'setup_completed'
      and metadata->>'setup_fingerprint' = setup_fingerprint
  ) then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      auth.uid(),
      'setup_completed',
      'restaurants',
      p_restaurant_id,
      jsonb_build_object(
        'inventory_items_saved', inventory_count,
        'supplier_recipients_saved', supplier_count,
        'recipe_mappings_saved', mapping_count,
        'pos_sales_rows_saved', sale_count,
        'attachment_metadata_saved', attachment_count,
        'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
        'setup_fingerprint', setup_fingerprint
      )
    );
  end if;

  return jsonb_build_object(
    'inventory_items_saved', inventory_count,
    'supplier_recipients_saved', supplier_count,
    'recipe_mappings_saved', mapping_count,
    'pos_sales_rows_saved', sale_count,
    'attachment_metadata_saved', attachment_count,
    'skipped_recipe_ingredients', p_skipped_recipe_ingredients,
    'setup_fingerprint', setup_fingerprint
  );
end;
$$;

create or replace function public.replace_operational_signals(
  p_restaurant_id uuid,
  p_recommendations jsonb default '[]'::jsonb,
  p_insights jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_result jsonb;
  insight_result jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  -- The nested RPCs repeat actor/role checks and perform payload validation.
  -- PostgreSQL keeps both calls inside this function's transaction, so either
  -- both signal sets are replaced or neither one is.
  recommendation_result := public.replace_pending_purchase_recommendations(
    p_restaurant_id,
    p_recommendations
  );
  insight_result := public.replace_operational_insights(
    p_restaurant_id,
    p_insights
  );
  return jsonb_build_object(
    'recommendations', recommendation_result,
    'insights', insight_result
  );
end;
$$;

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
  )
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
    null::text as source_record_id
  from public.pos_sales sale
  where sale.restaurant_id = p_restaurant_id
    and (
      sale.sale_date = operating_date
      or sale.sale_date in (select day.sale_date from historical_service_days day)
    )
  group by sale.sale_date, sale.item_name, sale.category
  order by sale.sale_date desc, sale.item_name;
end;
$$;

create or replace function public.update_inventory_item_and_signals(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_last_updated timestamptz,
  p_patch jsonb,
  p_recommendations jsonb default '[]'::jsonb,
  p_insights jsonb default '[]'::jsonb
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  item_row public.inventory_items%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_patch) <> 'object'
     or safe_patch = '{}'::jsonb
     or safe_patch - array['current_quantity', 'par_level', 'reorder_threshold', 'supplier_name'] <> '{}'::jsonb then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id
  for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if p_expected_last_updated is null or item_row.last_updated is distinct from p_expected_last_updated then
    raise exception 'Inventory item changed since it was loaded' using errcode = '40001';
  end if;

  item_row.current_quantity := case
    when safe_patch ? 'current_quantity' then (safe_patch->>'current_quantity')::numeric
    else item_row.current_quantity
  end;
  item_row.par_level := case
    when safe_patch ? 'par_level' then (safe_patch->>'par_level')::numeric
    else item_row.par_level
  end;
  item_row.reorder_threshold := case
    when safe_patch ? 'reorder_threshold' then (safe_patch->>'reorder_threshold')::numeric
    else item_row.reorder_threshold
  end;
  item_row.supplier_name := case
    when safe_patch ? 'supplier_name' then trim(safe_patch->>'supplier_name')
    else item_row.supplier_name
  end;

  if item_row.current_quantity not between 0 and 1000000
     or item_row.par_level not between 0 and 1000000
     or item_row.reorder_threshold not between 0 and 1000000
     or length(item_row.supplier_name) not between 1 and 160 then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;

  update public.inventory_items
  set current_quantity = item_row.current_quantity,
      par_level = item_row.par_level,
      reorder_threshold = item_row.reorder_threshold,
      supplier_name = item_row.supplier_name,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id
  returning * into item_row;

  perform public.replace_pending_purchase_recommendations(p_restaurant_id, p_recommendations);
  perform public.replace_operational_insights(p_restaurant_id, p_insights);
  return item_row;
end;
$$;

create or replace function public.save_recipe_mapping_and_signals(
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_menu_item_name text,
  p_inventory_item_id uuid,
  p_quantity_used_per_sale numeric,
  p_unit text,
  p_expected_quantity numeric,
  p_recommendations jsonb default '[]'::jsonb,
  p_insights jsonb default '[]'::jsonb
)
returns public.menu_item_ingredients
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_row public.menu_item_ingredients%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  p_menu_item_name := trim(p_menu_item_name);
  p_unit := trim(p_unit);
  if length(p_menu_item_name) not between 1 and 200
     or length(p_unit) not between 1 and 40
     or p_quantity_used_per_sale is null
     or p_quantity_used_per_sale <= 0
     or p_quantity_used_per_sale > 10000 then
    raise exception 'Recipe mapping is outside supported limits' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.inventory_items
    where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  ) then
    raise exception 'Inventory item not found';
  end if;

  if p_mapping_id is not null then
    select * into mapping_row
    from public.menu_item_ingredients
    where restaurant_id = p_restaurant_id
      and id = p_mapping_id
    for update;
    if not found then raise exception 'Recipe mapping not found'; end if;
    if p_expected_quantity is null
       or mapping_row.quantity_used_per_sale is distinct from p_expected_quantity then
      raise exception 'Recipe mapping changed since it was loaded' using errcode = '40001';
    end if;
    if mapping_row.inventory_item_id is distinct from p_inventory_item_id then
      raise exception 'Recipe mapping inventory item cannot be reassigned' using errcode = '22023';
    end if;

    update public.menu_item_ingredients
    set menu_item_name = p_menu_item_name,
        quantity_used_per_sale = p_quantity_used_per_sale,
        unit = p_unit
    where restaurant_id = p_restaurant_id and id = p_mapping_id
    returning * into mapping_row;
  else
    perform pg_advisory_xact_lock(hashtextextended(
      p_restaurant_id::text || E'\x1frecipe\x1f' || lower(p_menu_item_name) || E'\x1f' || p_inventory_item_id::text,
      0
    ));
    select * into mapping_row
    from public.menu_item_ingredients
    where restaurant_id = p_restaurant_id
      and inventory_item_id = p_inventory_item_id
      and lower(trim(menu_item_name)) = lower(p_menu_item_name)
    order by id
    limit 1
    for update;

    if found then
      update public.menu_item_ingredients
      set menu_item_name = p_menu_item_name,
          quantity_used_per_sale = p_quantity_used_per_sale,
          unit = p_unit
      where restaurant_id = p_restaurant_id and id = mapping_row.id
      returning * into mapping_row;
    else
      insert into public.menu_item_ingredients (
        restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
      ) values (
        p_restaurant_id, p_menu_item_name, p_inventory_item_id, p_quantity_used_per_sale, p_unit
      )
      returning * into mapping_row;
    end if;
  end if;

  perform public.replace_pending_purchase_recommendations(p_restaurant_id, p_recommendations);
  perform public.replace_operational_insights(p_restaurant_id, p_insights);
  return mapping_row;
end;
$$;

revoke all on function public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer)
  from public, anon;
revoke all on function public.replace_operational_signals(uuid, jsonb, jsonb)
  from public, anon;
revoke all on function public.fetch_planning_sales(uuid, integer)
  from public, anon;
revoke all on function public.update_inventory_item_and_signals(uuid, uuid, timestamptz, jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.save_recipe_mapping_and_signals(uuid, uuid, text, uuid, numeric, text, numeric, jsonb, jsonb)
  from public, anon;
grant execute on function public.save_restaurant_setup(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, integer)
  to authenticated;
grant execute on function public.replace_operational_signals(uuid, jsonb, jsonb)
  to authenticated;
grant execute on function public.fetch_planning_sales(uuid, integer)
  to authenticated;
grant execute on function public.update_inventory_item_and_signals(uuid, uuid, timestamptz, jsonb, jsonb, jsonb)
  to authenticated;
grant execute on function public.save_recipe_mapping_and_signals(uuid, uuid, text, uuid, numeric, text, numeric, jsonb, jsonb)
  to authenticated;

-- These setup-only tables are now writable through save_restaurant_setup.
-- They remain readable under their existing tenant-scoped RLS policies.
revoke insert, update on public.supplier_recipients from authenticated;
revoke insert, update, delete on public.setup_attachments from authenticated;
revoke insert, update, delete on public.inventory_items from authenticated;
revoke insert, update, delete on public.menu_item_ingredients from authenticated;
