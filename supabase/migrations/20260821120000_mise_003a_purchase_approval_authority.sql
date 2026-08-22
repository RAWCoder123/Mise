-- MISE-003A: informational recommendations remain visible, but approval and
-- supplier-draft creation require current server-evaluated operational evidence.

alter table public.pos_integrations
  add column if not exists authority_window_from date,
  add column if not exists authority_window_to date,
  add column if not exists authority_window_completed_at timestamptz;

alter table public.pos_integrations
  drop constraint if exists pos_integrations_authority_window_check;
alter table public.pos_integrations
  add constraint pos_integrations_authority_window_check check (
    (authority_window_from is null and authority_window_to is null and authority_window_completed_at is null)
    or (
      authority_window_from is not null
      and authority_window_to is not null
      and authority_window_completed_at is not null
      and authority_window_to >= authority_window_from
    )
  );

comment on column public.pos_integrations.authority_window_from is
  'First service date covered by the most recent fully paginated provider import.';
comment on column public.pos_integrations.authority_window_to is
  'Last service date covered by the most recent fully paginated provider import.';
comment on column public.pos_integrations.authority_window_completed_at is
  'Server time at which the declared provider import window completed successfully.';

alter table public.menu_items
  add column if not exists recipe_revision bigint not null default 0,
  add column if not exists recipe_confirmed_revision bigint,
  add column if not exists recipe_confirmed_at timestamptz,
  add column if not exists recipe_confirmed_by uuid references auth.users(id) on delete set null;

alter table public.menu_items
  drop constraint if exists menu_items_recipe_authority_check;
alter table public.menu_items
  add constraint menu_items_recipe_authority_check check (
    recipe_revision >= 0
    and (recipe_confirmed_revision is null or recipe_confirmed_revision = recipe_revision)
    and (
      (recipe_confirmed_revision is null and recipe_confirmed_at is null and recipe_confirmed_by is null)
      or (recipe_confirmed_revision is not null and recipe_confirmed_at is not null)
    )
  );

comment on column public.menu_items.recipe_revision is
  'Monotonic material recipe revision. Ingredient changes increment it and invalidate confirmation.';
comment on column public.menu_items.recipe_confirmed_revision is
  'Exact recipe revision explicitly confirmed complete by an operator.';

alter table public.inventory_events
  add column if not exists authority_projected_quantity numeric;

alter table public.inventory_events
  drop constraint if exists inventory_events_authority_projected_quantity_check;
alter table public.inventory_events
  add constraint inventory_events_authority_projected_quantity_check check (
    authority_projected_quantity is null
    or (
      authority_projected_quantity >= 0
      and authority_projected_quantity <= 1000000
      and authority_projected_quantity::text not in ('NaN', 'Infinity', '-Infinity')
    )
  );

comment on column public.inventory_events.authority_projected_quantity is
  'Native-unit on-hand after this applied event. Null legacy rows cannot establish MISE-003A purchase authority.';

alter table public.purchase_recommendations
  add column if not exists approval_authority jsonb,
  add column if not exists approval_evaluated_at timestamptz,
  add column if not exists quantity_overridden boolean not null default false;

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_approval_authority_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_approval_authority_check check (
    approval_authority is null or (
      jsonb_typeof(approval_authority) = 'object'
      and octet_length(approval_authority::text) <= 32768
    )
  );

alter table public.supplier_orders
  add column if not exists purchase_authority jsonb not null default '{}'::jsonb,
  add column if not exists purchase_authority_evaluated_at timestamptz;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_purchase_authority_check;
alter table public.supplier_orders
  add constraint supplier_orders_purchase_authority_check check (
    jsonb_typeof(purchase_authority) = 'object'
    and octet_length(purchase_authority::text) <= 131072
  );

-- Stamp the exact native-unit result before the existing AFTER projection
-- trigger runs. A fresh post-migration count is therefore required before an
-- item can become purchase-authoritative; historical current_quantity is never
-- silently reinterpreted as evidence.
create or replace function private.stamp_inventory_event_authority_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_quantity numeric;
  quantity_per_unit numeric;
  native_event_quantity numeric;
begin
  new.authority_projected_quantity := null;
  if not new.projection_applied then
    return new;
  end if;

  select item.current_quantity, item.canonical_quantity_per_unit
  into prior_quantity, quantity_per_unit
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for authority projection' using errcode = '23503';
  end if;
  if quantity_per_unit is null or quantity_per_unit <= 0
    or quantity_per_unit::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise exception 'Inventory item canonical conversion is not verified' using errcode = '22023';
  end if;

  native_event_quantity := new.quantity / quantity_per_unit;
  new.authority_projected_quantity := case
    when new.event_type = 'count' then native_event_quantity
    when new.event_type = 'stockout' then 0
    when new.event_type = 'receipt' then prior_quantity + native_event_quantity
    when new.event_type in ('waste', 'usage') then prior_quantity - native_event_quantity
    else prior_quantity + native_event_quantity
  end;

  if new.authority_projected_quantity is null
    or new.authority_projected_quantity < 0
    or new.authority_projected_quantity > 1000000
    or new.authority_projected_quantity::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise exception 'Inventory event would move on-hand outside supported limits' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_stamp_inventory_event_authority_projection on public.inventory_events;
create trigger zz_stamp_inventory_event_authority_projection
before insert on public.inventory_events
for each row execute function private.stamp_inventory_event_authority_projection();

create or replace function private.apply_inventory_event_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.projection_applied then
    return new;
  end if;
  if new.authority_projected_quantity is null then
    raise exception 'Inventory authority projection is incomplete' using errcode = '22023';
  end if;

  update public.inventory_items
  set current_quantity = new.authority_projected_quantity,
      last_updated = clock_timestamp()
  where restaurant_id = new.restaurant_id
    and id = new.inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for projection' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function private.stamp_inventory_event_authority_projection()
  from public, anon, authenticated, service_role;

create or replace function private.purchase_units_compatible(
  p_recipe_unit text,
  p_item_unit text,
  p_item_canonical_unit text
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(lower(trim(coalesce(p_recipe_unit, ''))), '') is not null
    and (
      lower(trim(p_recipe_unit)) = lower(trim(coalesce(p_item_unit, '')))
      or (
        private.canonical_unit_for_standard_unit(p_recipe_unit) is not null
        and private.canonical_unit_for_standard_unit(p_recipe_unit) = p_item_canonical_unit
      )
    );
$$;

revoke all on function private.purchase_units_compatible(text, text, text)
  from public, anon, authenticated, service_role;

create or replace function private.invalidate_menu_item_recipe_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_menu_item_id uuid := case when tg_op = 'INSERT' then null else old.menu_item_id end;
  new_menu_item_id uuid := case when tg_op = 'DELETE' then null else new.menu_item_id end;
begin
  if old_menu_item_id is not null then
    update public.menu_items
    set recipe_revision = recipe_revision + 1,
        recipe_confirmed_revision = null,
        recipe_confirmed_at = null,
        recipe_confirmed_by = null,
        updated_at = clock_timestamp()
    where restaurant_id = old.restaurant_id and id = old_menu_item_id;
  end if;
  if new_menu_item_id is not null and new_menu_item_id is distinct from old_menu_item_id then
    update public.menu_items
    set recipe_revision = recipe_revision + 1,
        recipe_confirmed_revision = null,
        recipe_confirmed_at = null,
        recipe_confirmed_by = null,
        updated_at = clock_timestamp()
    where restaurant_id = new.restaurant_id and id = new_menu_item_id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists invalidate_menu_item_recipe_authority on public.menu_item_ingredients;
create trigger invalidate_menu_item_recipe_authority
after insert or delete or update of menu_item_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
on public.menu_item_ingredients
for each row execute function private.invalidate_menu_item_recipe_authority();

revoke all on function private.invalidate_menu_item_recipe_authority()
  from public, anon, authenticated, service_role;

create or replace function public.list_recipe_authorities(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'menuItemId', item.id,
      'menuItemName', item.name,
      'active', item.active,
      'recipeRevision', item.recipe_revision,
      'confirmedRevision', item.recipe_confirmed_revision,
      'confirmedAt', item.recipe_confirmed_at,
      'ready', item.active
        and coalesce(item.recipe_confirmed_revision = item.recipe_revision, false)
        and exists (
          select 1 from public.menu_item_ingredients ingredient
          where ingredient.restaurant_id = p_restaurant_id and ingredient.menu_item_id = item.id
        )
    ) order by item.name, item.id)
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.confirm_recipe_complete(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.menu_items%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into item_row
  from public.menu_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_menu_item_id
  for update;
  if not found then raise exception 'Menu item not found' using errcode = '22023'; end if;
  if not item_row.active then raise exception 'Inactive menu items cannot confirm recipes' using errcode = '22023'; end if;
  if p_expected_revision is null or p_expected_revision is distinct from item_row.recipe_revision then
    raise exception 'Recipe changed; review the current ingredients' using errcode = '40001';
  end if;
  if not exists (
    select 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id and ingredient.menu_item_id = p_menu_item_id
  ) then
    raise exception 'Add at least one recipe ingredient before confirming' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.menu_item_ingredients ingredient
    left join public.inventory_items inventory
      on inventory.restaurant_id = p_restaurant_id and inventory.id = ingredient.inventory_item_id
    where ingredient.restaurant_id = p_restaurant_id
      and ingredient.menu_item_id = p_menu_item_id
      and (
        inventory.id is null
        or ingredient.quantity_used_per_sale <= 0
        or ingredient.quantity_used_per_sale::text in ('NaN', 'Infinity', '-Infinity')
        or inventory.canonical_unit_verification_status <> 'verified'
        or inventory.canonical_unit is null
        or inventory.canonical_quantity_per_unit is null
        or inventory.canonical_quantity_per_unit <= 0
        or not private.purchase_units_compatible(ingredient.unit, inventory.unit, inventory.canonical_unit)
      )
  ) then
    raise exception 'Recipe ingredients need verified inventory units' using errcode = '22023';
  end if;

  update public.menu_items
  set recipe_confirmed_revision = recipe_revision,
      recipe_confirmed_at = clock_timestamp(),
      recipe_confirmed_by = auth.uid(),
      updated_at = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_menu_item_id
  returning * into item_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recipe_confirmed_complete', 'menu_items', item_row.id,
    jsonb_build_object('recipe_revision', item_row.recipe_revision)
  );

  return jsonb_build_object(
    'menuItemId', item_row.id,
    'menuItemName', item_row.name,
    'active', item_row.active,
    'recipeRevision', item_row.recipe_revision,
    'confirmedRevision', item_row.recipe_confirmed_revision,
    'confirmedAt', item_row.recipe_confirmed_at,
    'ready', true
  );
end;
$$;

revoke all on function public.list_recipe_authorities(uuid) from public, anon;
revoke all on function public.confirm_recipe_complete(uuid, uuid, bigint) from public, anon;
grant execute on function public.list_recipe_authorities(uuid) to authenticated;
grant execute on function public.confirm_recipe_complete(uuid, uuid, bigint) to authenticated;

-- Authority-relevant identity changes invalidate generated planning state.
drop trigger if exists pos_integrations_bump_planning_revision on public.pos_integrations;
create trigger pos_integrations_bump_planning_revision
after insert or delete or update of status, external_location_id, last_sync_at,
  authority_window_from, authority_window_to, authority_window_completed_at
on public.pos_integrations
for each row execute function private.bump_restaurant_planning_revision();

drop trigger if exists pos_locations_bump_planning_revision on public.pos_locations;
create trigger pos_locations_bump_planning_revision
after insert or delete or update of pos_integration_id, external_location_id, status
on public.pos_locations
for each row execute function private.bump_restaurant_planning_revision();

drop trigger if exists pos_catalog_mappings_bump_planning_revision on public.pos_catalog_item_mappings;
create trigger pos_catalog_mappings_bump_planning_revision
after insert or delete or update of pos_location_id, external_catalog_item_id,
  external_variation_id, menu_item_id, verification_status, effective_from, effective_to
on public.pos_catalog_item_mappings
for each row execute function private.bump_restaurant_planning_revision();

drop trigger if exists menu_items_authority_bump_planning_revision on public.menu_items;
create trigger menu_items_authority_bump_planning_revision
after insert or delete or update of active, recipe_revision, recipe_confirmed_revision
on public.menu_items
for each row execute function private.bump_restaurant_planning_revision();

-- The existing Square ingestion RPC already proves full pagination before it is
-- invoked. Persist its requested date range atomically with the applied sales.
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
  removed_count integer := 0;
  catalog_processed integer := 0;
  resolved_menu_item_id uuid;
  location_id uuid;
  catalog_external_name text;
  catalog_item_external_id text;
  catalog_variation_id text;
  updated_mapping_id uuid;
  completed_at timestamptz := clock_timestamp();
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

-- Deterministic bounded blocker accumulation. One entry per reason code keeps
-- UI and audit output compact even when many provider sale lines share a defect.
create or replace function private.append_purchase_authority_blocker(
  p_blockers jsonb,
  p_code text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_blockers, '[]'::jsonb)) entry
    where entry->>'code' = p_code
  ) then return coalesce(p_blockers, '[]'::jsonb); end if;
  return coalesce(p_blockers, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'code', p_code,
    'description', left(p_description, 240),
    'metadata', case
      when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then p_metadata
      else '{}'::jsonb
    end
  ));
end;
$$;

revoke all on function private.append_purchase_authority_blocker(jsonb, text, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.evaluate_purchase_recommendation_authority(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_evaluated_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  item_row public.inventory_items%rowtype;
  signal_row private.restaurant_signal_state%rowtype;
  newest_sequence_count public.inventory_events%rowtype;
  verified_count public.inventory_events%rowtype;
  projected_quantity numeric;
  blockers jsonb := '[]'::jsonb;
  evidence jsonb;
  operating_date date;
  provider_window_from date;
  provider_window_to date;
  provider_window_completed_at timestamptz;
  provider_sale_count integer := 0;
  mapping_count integer;
  resolved_menu_item_id uuid;
  identity_row record;
  menu_row record;
  history_row record;
  recipe_revisions jsonb := '{}'::jsonb;
  system_drafting_ready boolean := false;
  restaurant_drafting_ready boolean := false;
  draft_authority_order_id uuid;
  draft_authority_gap_count integer := 0;
begin
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = '22023'; end if;

  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = recommendation_row.inventory_item_id;
  if not found then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'recommendation_no_longer_actionable',
      'The inventory item for this recommendation is no longer available.', '{}'::jsonb
    );
  end if;

  select * into signal_row
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id;

  if recommendation_row.generation_source in ('mise_rules', 'legacy_client') and (
    signal_row.restaurant_id is null
    or signal_row.status <> 'current'
    or recommendation_row.planning_revision is null
    or signal_row.signals_revision is distinct from recommendation_row.planning_revision
  ) then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'planning_revision_stale',
      'This recommendation was calculated from an older planning revision.',
      jsonb_build_object(
        'recommendationRevision', recommendation_row.planning_revision,
        'currentRevision', signal_row.planning_revision
      )
    );
  end if;

  select coalesce(controls.ordering_policy = 'draft_only' and controls.order_drafting_enabled, false)
  into system_drafting_ready
  from public.system_operational_controls controls where controls.singleton;
  select coalesce(controls.ordering_policy = 'draft_only' and controls.order_drafting_enabled, false)
  into restaurant_drafting_ready
  from public.restaurant_operational_controls controls where controls.restaurant_id = p_restaurant_id;
  if not coalesce(system_drafting_ready, false) or not coalesce(restaurant_drafting_ready, false) then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'ordering_disabled',
      'Supplier drafting is disabled for this restaurant.', '{}'::jsonb
    );
  end if;

  if nullif(trim(recommendation_row.supplier_name), '') is null
    or length(trim(recommendation_row.supplier_name)) > 160
    or (item_row.id is not null and nullif(trim(item_row.supplier_name), '') is null)
  then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'supplier_missing', 'This item needs a valid supplier before approval.', '{}'::jsonb
    );
  elsif item_row.id is not null and lower(trim(recommendation_row.supplier_name)) <> lower(trim(item_row.supplier_name)) then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'supplier_mismatch',
      'The recommendation supplier no longer matches the inventory item supplier.', '{}'::jsonb
    );
  elsif recommendation_row.supplier_order_id is not null and not exists (
    select 1 from public.supplier_orders linked_order
    where linked_order.restaurant_id = p_restaurant_id
      and linked_order.id = recommendation_row.supplier_order_id
      and linked_order.status = 'draft'
      and lower(trim(linked_order.supplier_name)) = lower(trim(recommendation_row.supplier_name))
  ) then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'supplier_mismatch',
      'The linked supplier draft no longer matches this recommendation.', '{}'::jsonb
    );
  end if;

  if recommendation_row.supplier_order_id is not null then
    select existing_order.id into draft_authority_order_id
    from public.supplier_orders existing_order
    where existing_order.restaurant_id = p_restaurant_id
      and existing_order.id = recommendation_row.supplier_order_id
      and existing_order.status = 'draft'
      and lower(trim(existing_order.supplier_name)) = lower(trim(recommendation_row.supplier_name));
  elsif nullif(trim(recommendation_row.supplier_name), '') is not null then
    select existing_order.id into draft_authority_order_id
    from public.supplier_orders existing_order
    where existing_order.restaurant_id = p_restaurant_id
      and existing_order.supplier_name = recommendation_row.supplier_name
      and existing_order.status = 'draft'
    order by existing_order.created_at desc, existing_order.id desc
    limit 1;
  end if;

  if draft_authority_order_id is not null then
    select count(*) into draft_authority_gap_count
    from public.purchase_recommendations existing_line
    join public.supplier_orders existing_order
      on existing_order.restaurant_id = p_restaurant_id
      and existing_order.id = draft_authority_order_id
    where existing_line.restaurant_id = p_restaurant_id
      and existing_line.supplier_order_id = draft_authority_order_id
      and existing_line.status = 'approved'
      and (
        coalesce(jsonb_typeof(existing_line.approval_authority), 'null') <> 'object'
        or coalesce(existing_line.approval_authority->>'ready', 'false') <> 'true'
        or not coalesce(existing_order.purchase_authority ? existing_line.id::text, false)
        or existing_order.purchase_authority->existing_line.id::text
          is distinct from existing_line.approval_authority
      );
    if draft_authority_gap_count > 0 then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'draft_authority_incomplete',
        'This supplier draft contains an approved line without purchase authority.',
        jsonb_build_object(
          'supplierOrderId', draft_authority_order_id,
          'unattestedLineCount', draft_authority_gap_count
        )
      );
    end if;
  end if;

  if item_row.id is not null and (
    item_row.canonical_unit_verification_status <> 'verified'
    or item_row.canonical_unit is null
    or item_row.canonical_quantity_per_unit is null
    or item_row.canonical_quantity_per_unit <= 0
    or item_row.canonical_quantity_per_unit::text in ('NaN', 'Infinity', '-Infinity')
    or (
      lower(trim(recommendation_row.unit)) <> lower(trim(item_row.unit))
      and lower(trim(recommendation_row.unit)) <> lower(trim(item_row.canonical_unit))
    )
  ) then
    blockers := private.append_purchase_authority_blocker(
      blockers, 'canonical_unit_unverified',
      'The inventory item needs a verified purchasing unit before approval.', '{}'::jsonb
    );
  end if;

  if item_row.id is not null then
    select * into newest_sequence_count
    from public.inventory_events event
    where event.restaurant_id = p_restaurant_id
      and event.inventory_item_id = item_row.id
      and event.event_type = 'count'
    order by event.sequence desc, event.id desc
    limit 1;

    select * into verified_count
    from public.inventory_events event
    where event.restaurant_id = p_restaurant_id
      and event.inventory_item_id = item_row.id
      and event.event_type = 'count'
      and event.effective_at <= p_evaluated_at + interval '2 minutes'
    order by event.effective_at desc, event.sequence desc, event.id desc
    limit 1;

    if verified_count.id is null then
      if newest_sequence_count.id is not null and newest_sequence_count.effective_at > p_evaluated_at + interval '2 minutes' then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_count_future',
          'The physical count is future-dated and cannot establish current inventory.', '{}'::jsonb
        );
      else
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_count_missing',
          'Record a verified physical count before approving this item.', '{}'::jsonb
        );
      end if;
    else
      if p_evaluated_at - verified_count.effective_at > interval '36 hours' then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_count_stale',
          'The physical inventory count is older than 36 hours.',
          jsonb_build_object('countedAt', verified_count.effective_at)
        );
      end if;
      if newest_sequence_count.id is not null
        and newest_sequence_count.effective_at > p_evaluated_at + interval '2 minutes'
      then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_count_future',
          'A future-dated count makes the inventory projection untrusted.', '{}'::jsonb
        );
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_projection_untrusted',
          'Record a new physical count to restore inventory chronology.', '{}'::jsonb
        );
      end if;
      if newest_sequence_count.id is not null and exists (
        select 1 from public.inventory_events newer_physical
        where newer_physical.restaurant_id = p_restaurant_id
          and newer_physical.inventory_item_id = item_row.id
          and newer_physical.event_type = 'count'
          and newer_physical.effective_at <= p_evaluated_at + interval '2 minutes'
          and newer_physical.effective_at > newest_sequence_count.effective_at
          and newer_physical.sequence < newest_sequence_count.sequence
          and newest_sequence_count.projection_applied
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_projection_untrusted',
          'Inventory count chronology is out of order; record a new physical count.', '{}'::jsonb
        );
      end if;
      if exists (
        select 1 from public.inventory_events delayed
        where delayed.restaurant_id = p_restaurant_id
          and delayed.inventory_item_id = item_row.id
          and delayed.event_type <> 'count'
          and delayed.sequence > verified_count.sequence
          and delayed.effective_at <= verified_count.effective_at
          and delayed.projection_applied
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_projection_untrusted',
          'Delayed inventory evidence contaminated the current projection.', '{}'::jsonb
        );
      end if;
      if not verified_count.projection_applied or exists (
        select 1 from public.inventory_events applied
        where applied.restaurant_id = p_restaurant_id
          and applied.inventory_item_id = item_row.id
          and applied.sequence >= verified_count.sequence
          and applied.projection_applied
          and applied.authority_projected_quantity is null
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'inventory_evidence_incomplete',
          'A fresh post-upgrade count is required before this item can be approved.', '{}'::jsonb
        );
      else
        select applied.authority_projected_quantity into projected_quantity
        from public.inventory_events applied
        where applied.restaurant_id = p_restaurant_id
          and applied.inventory_item_id = item_row.id
          and applied.sequence >= verified_count.sequence
          and applied.projection_applied
        order by applied.sequence desc, applied.id desc
        limit 1;
      end if;
    end if;

    if projected_quantity is null then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'inventory_evidence_incomplete',
        'Authoritative on-hand inventory could not be derived from the ledger.', '{}'::jsonb
      );
    elsif projected_quantity > item_row.reorder_threshold then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'recommendation_no_longer_actionable',
        'Current authoritative inventory is above its reorder level.',
        jsonb_build_object('projectedQuantity', projected_quantity, 'reorderThreshold', item_row.reorder_threshold)
      );
    end if;
  end if;

  begin
    select timezone(restaurant.timezone, p_evaluated_at)::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then operating_date := p_evaluated_at::date;
  end;
  operating_date := coalesce(operating_date, p_evaluated_at::date);

  select count(*) into provider_sale_count
  from public.pos_sales sale
  where sale.restaurant_id = p_restaurant_id
    and sale.sale_date between operating_date - 27 and operating_date
    and (
      lower(trim(coalesce(sale.source_pos, ''))) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    );

  if provider_sale_count > 0 then
    if exists (
      select 1 from public.pos_sales sale
      where sale.restaurant_id = p_restaurant_id
        and sale.sale_date between operating_date - 27 and operating_date
        and (
          lower(trim(coalesce(sale.source_pos, ''))) in ('square', 'toast', 'clover', 'lightspeed')
          or sale.provider_location_id is not null
          or sale.provider_catalog_item_id is not null
          or sale.provider_variation_id is not null
        )
        and not exists (
          select 1
          from public.pos_locations location
          join public.pos_integrations integration
            on integration.restaurant_id = p_restaurant_id
            and integration.id = location.pos_integration_id
            and integration.provider = 'square'
            and integration.status = 'connected'
          where location.restaurant_id = p_restaurant_id
            and location.status = 'active'
            and location.external_location_id = sale.provider_location_id
        )
    ) then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'pos_not_connected',
        'Square and every relevant location must be connected before approval.', '{}'::jsonb
      );
    end if;

    if exists (
      select 1
      from public.pos_integrations integration
      where integration.restaurant_id = p_restaurant_id
        and integration.provider = 'square'
        and exists (
          select 1 from public.pos_locations location
          join public.pos_sales sale
            on sale.restaurant_id = p_restaurant_id
            and sale.provider_location_id = location.external_location_id
            and sale.sale_date between operating_date - 27 and operating_date
          where location.restaurant_id = p_restaurant_id
            and location.pos_integration_id = integration.id
        )
        and (
          integration.authority_window_from is null
          or integration.authority_window_to is null
          or integration.authority_window_completed_at is null
          or integration.authority_window_from > operating_date - 27
          or integration.authority_window_to < operating_date
          or integration.authority_window_to > operating_date
          or integration.authority_window_completed_at > p_evaluated_at + interval '2 minutes'
        )
    ) then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'planning_window_incomplete',
        'Run a complete 28-day Square sync before approving provider-derived demand.', '{}'::jsonb
      );
    end if;

    if exists (
      select 1
      from public.pos_integrations integration
      where integration.restaurant_id = p_restaurant_id
        and integration.provider = 'square'
        and exists (
          select 1 from public.pos_locations location
          join public.pos_sales sale
            on sale.restaurant_id = p_restaurant_id
            and sale.provider_location_id = location.external_location_id
            and sale.sale_date between operating_date - 27 and operating_date
          where location.restaurant_id = p_restaurant_id
            and location.pos_integration_id = integration.id
        )
        and (
          integration.status <> 'connected'
          or integration.last_sync_at is null
          or integration.authority_window_completed_at is null
          or p_evaluated_at - integration.last_sync_at > interval '24 hours'
          or p_evaluated_at - integration.authority_window_completed_at > interval '24 hours'
          or integration.last_sync_at > p_evaluated_at + interval '2 minutes'
          or integration.authority_window_completed_at > p_evaluated_at + interval '2 minutes'
        )
    ) then
      blockers := private.append_purchase_authority_blocker(
        blockers, 'pos_sync_stale',
        'Square sales have not completed a successful sync in the last 24 hours.', '{}'::jsonb
      );
    end if;

    select min(integration.authority_window_from), max(integration.authority_window_to),
      max(integration.authority_window_completed_at)
    into provider_window_from, provider_window_to, provider_window_completed_at
    from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id and integration.provider = 'square';

    for identity_row in
      select distinct
        lower(trim(coalesce(sale.source_pos, ''))) as source_pos,
        sale.provider_location_id,
        sale.provider_catalog_item_id,
        sale.provider_variation_id
      from public.pos_sales sale
      where sale.restaurant_id = p_restaurant_id
        and sale.sale_date between operating_date - 27 and operating_date
        and (
          lower(trim(coalesce(sale.source_pos, ''))) in ('square', 'toast', 'clover', 'lightspeed')
          or sale.provider_location_id is not null
          or sale.provider_catalog_item_id is not null
          or sale.provider_variation_id is not null
        )
      order by 1, 2, 3, 4
    loop
      if identity_row.source_pos <> 'square'
        or nullif(trim(coalesce(identity_row.provider_location_id, '')), '') is null
        or nullif(trim(coalesce(identity_row.provider_catalog_item_id, '')), '') is null
        or nullif(trim(coalesce(identity_row.provider_variation_id, '')), '') is null
      then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'provider_identity_incomplete',
          'A provider sale is missing catalog, location, or variation identity.', '{}'::jsonb
        );
        continue;
      end if;

      select count(*), min(mapping.menu_item_id::text)::uuid
      into mapping_count, resolved_menu_item_id
      from public.pos_catalog_item_mappings mapping
      join public.pos_locations location
        on location.restaurant_id = p_restaurant_id
        and location.id = mapping.pos_location_id
        and location.status = 'active'
        and location.external_location_id = identity_row.provider_location_id
      join public.pos_integrations mapping_integration
        on mapping_integration.restaurant_id = p_restaurant_id
        and mapping_integration.id = location.pos_integration_id
        and mapping_integration.provider = 'square'
        and mapping_integration.status = 'connected'
      where mapping.restaurant_id = p_restaurant_id
        and mapping.external_catalog_item_id = identity_row.provider_catalog_item_id
        and mapping.external_variation_id = identity_row.provider_variation_id
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= p_evaluated_at
        and (mapping.effective_to is null or mapping.effective_to > p_evaluated_at);

      if mapping_count = 0 then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'provider_mapping_missing',
          'A Square menu mapping still needs verification.', '{}'::jsonb
        );
        continue;
      elsif mapping_count <> 1 then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'provider_mapping_ambiguous',
          'A Square sale resolves to more than one verified menu mapping.', '{}'::jsonb
        );
        continue;
      end if;

      select item.id, item.name, item.active, item.recipe_revision,
        item.recipe_confirmed_revision
      into menu_row
      from public.menu_items item
      where item.restaurant_id = p_restaurant_id and item.id = resolved_menu_item_id;
      if menu_row.id is null or not menu_row.active then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'recipe_missing',
          'An active mapped menu item is required for every provider sale.', '{}'::jsonb
        );
        continue;
      end if;

      recipe_revisions := recipe_revisions || jsonb_build_object(menu_row.id::text, menu_row.recipe_revision);
      if menu_row.recipe_confirmed_revision is null
        or menu_row.recipe_confirmed_revision is distinct from menu_row.recipe_revision
      then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'recipe_incomplete',
          'A mapped menu recipe has not been confirmed complete.',
          jsonb_build_object('menuItemId', menu_row.id, 'menuItemName', left(menu_row.name, 120))
        );
      end if;
      if not exists (
        select 1 from public.menu_item_ingredients ingredient
        where ingredient.restaurant_id = p_restaurant_id and ingredient.menu_item_id = menu_row.id
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'recipe_missing',
          'A mapped menu item has no recipe ingredients.',
          jsonb_build_object('menuItemId', menu_row.id, 'menuItemName', left(menu_row.name, 120))
        );
      end if;
      if exists (
        select 1
        from public.menu_item_ingredients ingredient
        left join public.inventory_items inventory
          on inventory.restaurant_id = p_restaurant_id and inventory.id = ingredient.inventory_item_id
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.menu_item_id = menu_row.id
          and inventory.id is null
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'recipe_inventory_reference_missing',
          'A recipe ingredient no longer resolves to restaurant inventory.', '{}'::jsonb
        );
      end if;
      if exists (
        select 1
        from public.menu_item_ingredients ingredient
        join public.inventory_items inventory
          on inventory.restaurant_id = p_restaurant_id and inventory.id = ingredient.inventory_item_id
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.menu_item_id = menu_row.id
          and (
            ingredient.quantity_used_per_sale <= 0
            or ingredient.quantity_used_per_sale::text in ('NaN', 'Infinity', '-Infinity')
            or inventory.canonical_unit_verification_status <> 'verified'
            or inventory.canonical_unit is null
            or inventory.canonical_quantity_per_unit is null
            or inventory.canonical_quantity_per_unit <= 0
            or not private.purchase_units_compatible(ingredient.unit, inventory.unit, inventory.canonical_unit)
          )
      ) then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'recipe_unit_incompatible',
          'A recipe ingredient needs a positive quantity and compatible verified unit.', '{}'::jsonb
        );
      end if;
    end loop;

    for history_row in
      with resolved_sales as (
        select sale.sale_date, exact_mapping.menu_item_id
        from public.pos_sales sale
        join lateral (
          select min(mapping.menu_item_id::text)::uuid as menu_item_id, count(*) as mapping_count
          from public.pos_catalog_item_mappings mapping
          join public.pos_locations location
            on location.restaurant_id = p_restaurant_id
            and location.id = mapping.pos_location_id
            and location.status = 'active'
            and location.external_location_id = sale.provider_location_id
          join public.pos_integrations mapping_integration
            on mapping_integration.restaurant_id = p_restaurant_id
            and mapping_integration.id = location.pos_integration_id
            and mapping_integration.provider = 'square'
            and mapping_integration.status = 'connected'
          where mapping.restaurant_id = p_restaurant_id
            and mapping.external_catalog_item_id = sale.provider_catalog_item_id
            and mapping.external_variation_id = sale.provider_variation_id
            and mapping.verification_status = 'verified'
            and mapping.effective_from <= p_evaluated_at
            and (mapping.effective_to is null or mapping.effective_to > p_evaluated_at)
        ) exact_mapping on exact_mapping.mapping_count = 1
        where sale.restaurant_id = p_restaurant_id
          and sale.sale_date between operating_date - 27 and operating_date
          and lower(trim(coalesce(sale.source_pos, ''))) = 'square'
      )
      select resolved.menu_item_id,
        count(distinct resolved.sale_date) filter (where resolved.sale_date < operating_date) as service_days,
        count(*) filter (where resolved.sale_date < operating_date) as observations
      from resolved_sales resolved
      where exists (
        select 1 from public.menu_item_ingredients ingredient
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.menu_item_id = resolved.menu_item_id
          and ingredient.inventory_item_id = recommendation_row.inventory_item_id
      )
      group by resolved.menu_item_id
    loop
      if history_row.service_days < 7 or history_row.observations < 3 then
        blockers := private.append_purchase_authority_blocker(
          blockers, 'demand_history_insufficient',
          'Provider demand needs at least seven service days and three observations.',
          jsonb_build_object(
            'menuItemId', history_row.menu_item_id,
            'serviceDays', history_row.service_days,
            'observations', history_row.observations
          )
        );
      end if;
    end loop;
  end if;

  evidence := jsonb_build_object(
    'recommendationId', recommendation_row.id,
    'inventoryItemId', recommendation_row.inventory_item_id,
    'countEventId', verified_count.id,
    'countedAt', verified_count.effective_at,
    'projectedQuantity', projected_quantity,
    'canonicalUnit', item_row.canonical_unit,
    'providerWindowFrom', provider_window_from,
    'providerWindowTo', provider_window_to,
    'providerWindowCompletedAt', provider_window_completed_at,
    'recipeRevisions', recipe_revisions,
    'basis', 'physical_count_reorder_policy'
  );

  return jsonb_build_object(
    'ready', jsonb_array_length(blockers) = 0,
    'blockers', blockers,
    'evaluatedAt', p_evaluated_at,
    'planningRevision', signal_row.planning_revision,
    'evidence', evidence
  );
end;
$$;

revoke all on function private.evaluate_purchase_recommendation_authority(uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.list_purchase_recommendation_authority(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  results jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  for recommendation_row in
    select recommendation.*
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.status = 'pending'
      and (
        recommendation.generation_source = 'manual'
        or private.signals_are_current(recommendation.restaurant_id, recommendation.planning_revision)
      )
    order by recommendation.created_at desc, recommendation.id
    limit 250
  loop
    results := results || jsonb_build_object(
      recommendation_row.id::text,
      private.evaluate_purchase_recommendation_authority(
        p_restaurant_id, recommendation_row.id, clock_timestamp()
      )
    );
  end loop;
  return results;
end;
$$;

revoke all on function public.list_purchase_recommendation_authority(uuid) from public, anon;
grant execute on function public.list_purchase_recommendation_authority(uuid) to authenticated;

create or replace function private.clear_stale_recommendation_authority()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'approved' then
    new.approval_authority := null;
    new.approval_evaluated_at := null;
    new.quantity_overridden := false;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_stale_recommendation_authority on public.purchase_recommendations;
create trigger clear_stale_recommendation_authority
before update of status on public.purchase_recommendations
for each row execute function private.clear_stale_recommendation_authority();

revoke all on function private.clear_stale_recommendation_authority()
  from public, anon, authenticated, service_role;

create or replace function private.remove_order_line_purchase_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.supplier_order_id is not null
    and old.status = 'approved'
    and (new.status <> 'approved' or new.supplier_order_id is distinct from old.supplier_order_id)
  then
    update public.supplier_orders
    set purchase_authority = purchase_authority - old.id::text
    where restaurant_id = old.restaurant_id and id = old.supplier_order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists remove_order_line_purchase_authority on public.purchase_recommendations;
create trigger remove_order_line_purchase_authority
after update of status, supplier_order_id on public.purchase_recommendations
for each row execute function private.remove_order_line_purchase_authority();

revoke all on function private.remove_order_line_purchase_authority()
  from public, anon, authenticated, service_role;

create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  item_row public.inventory_items%rowtype;
  previous_status text;
  authority jsonb;
  evaluated_at timestamptz := clock_timestamp();
  approved_quantity numeric;
  suggested_quantity numeric;
  was_quantity_overridden boolean;
  blocker_codes jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is not null and (
    p_recommended_quantity <= 0
    or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('dismissed', 'ordered') then raise exception 'Already handled'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || recommendation_row.supplier_name, 0)
  );
  if recommendation_row.status = 'approved' then
    select * into order_row from public.supplier_orders order_record
    where order_record.restaurant_id = p_restaurant_id
      and order_record.id = recommendation_row.supplier_order_id
    for update;
    return jsonb_build_object(
      'outcome', 'already_applied',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', case when order_row.id is null then null else to_jsonb(order_row) end,
      'authority', recommendation_row.approval_authority
    );
  end if;

  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = recommendation_row.inventory_item_id
  for update;
  if recommendation_row.supplier_order_id is not null then
    select * into order_row
    from public.supplier_orders linked_order
    where linked_order.restaurant_id = p_restaurant_id
      and linked_order.id = recommendation_row.supplier_order_id
    for update;
  end if;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;
  perform 1 from public.system_operational_controls controls where controls.singleton for share;
  perform 1 from public.restaurant_operational_controls controls
    where controls.restaurant_id = p_restaurant_id for share;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id for share;

  authority := private.evaluate_purchase_recommendation_authority(
    p_restaurant_id, p_recommendation_id, evaluated_at
  );
  if not coalesce((authority->>'ready')::boolean, false) then
    select coalesce(jsonb_agg(blocker->>'code' order by blocker->>'code'), '[]'::jsonb)
    into blocker_codes from jsonb_array_elements(authority->'blockers') blocker;
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'purchase_approval_blocked',
      'purchase_recommendations', recommendation_row.id,
      jsonb_build_object(
        'blocker_codes', blocker_codes,
        'planning_revision', authority->'planningRevision'
      )
    );
    return jsonb_build_object(
      'outcome', 'blocked',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', null,
      'authority', authority
    );
  end if;

  approved_quantity := coalesce(p_recommended_quantity, recommendation_row.recommended_quantity);
  suggested_quantity := recommendation_row.recommended_quantity;
  was_quantity_overridden := p_recommended_quantity is not null
    and p_recommended_quantity is distinct from recommendation_row.recommended_quantity;

  if order_row.id is null then
    select * into order_row
    from public.supplier_orders existing_order
    where existing_order.restaurant_id = p_restaurant_id
      and existing_order.supplier_name = recommendation_row.supplier_name
      and existing_order.status = 'draft'
    order by existing_order.created_at desc, existing_order.id desc
    limit 1
    for update;
  end if;

  if order_row.id is null then
    insert into public.supplier_orders (
      restaurant_id, supplier_name, order_message, operator_note, status,
      delivery_date, purchase_authority, purchase_authority_evaluated_at
    ) values (
      p_restaurant_id, recommendation_row.supplier_name,
      'Order draft for ' || recommendation_row.supplier_name || E'\n\nDelivery requested: Tomorrow morning',
      null, 'draft', current_date + 1, '{}'::jsonb, evaluated_at
    ) returning * into order_row;
  end if;

  update public.purchase_recommendations
  set status = 'approved',
      recommended_quantity = approved_quantity,
      supplier_order_id = order_row.id,
      approval_authority = authority,
      approval_evaluated_at = evaluated_at,
      quantity_overridden = was_quantity_overridden
  where restaurant_id = p_restaurant_id and id = p_recommendation_id
  returning * into recommendation_row;

  update public.supplier_orders
  set order_message = private.build_supplier_order_message(
        p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
      ),
      purchase_authority = coalesce(order_row.purchase_authority, '{}'::jsonb)
        || jsonb_build_object(recommendation_row.id::text, authority),
      purchase_authority_evaluated_at = evaluated_at
  where restaurant_id = p_restaurant_id and id = order_row.id
  returning * into order_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recommendation_approved',
    'purchase_recommendations', recommendation_row.id,
    jsonb_build_object(
      'supplier_name', recommendation_row.supplier_name,
      'urgency', recommendation_row.urgency,
      'supplier_order_id', order_row.id,
      'system_suggested_quantity', suggested_quantity,
      'approved_quantity', approved_quantity,
      'quantity_overridden', was_quantity_overridden,
      'authority_evaluated_at', evaluated_at
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', to_jsonb(order_row),
    'authority', authority
  );
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric) from public, anon;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric) to authenticated;
