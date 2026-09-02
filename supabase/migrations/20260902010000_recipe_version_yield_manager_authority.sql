-- Manager-facing recipe yield authority on public.recipe_versions.
-- Authenticated clients remain SELECT-only on recipe_versions; these SECURITY
-- DEFINER RPCs are the only mutation path for serving/prep/cooking yields.
-- Verified yield history is never rewritten in place — edits create or update
-- draft successors, and verify closes prior active windows before promoting.

create or replace function private.assert_recipe_yield_factors(
  p_serving_quantity numeric,
  p_prep_yield numeric,
  p_cooking_yield numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_serving_quantity is null
    or p_prep_yield is null
    or p_cooking_yield is null
    or p_serving_quantity <= 0
    or p_serving_quantity > 10000
    or p_prep_yield <= 0
    or p_prep_yield > 1
    or p_cooking_yield <= 0
    or p_cooking_yield > 1
  then
    raise exception 'Recipe yield factors are invalid' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_recipe_version_yields(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_serving_quantity numeric,
  p_prep_yield numeric,
  p_cooking_yield numeric,
  p_recipe_version_id uuid default null
)
returns public.recipe_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  version_row public.recipe_versions%rowtype;
  menu_exists boolean := false;
  next_version_number integer;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_menu_item_id is null then
    raise exception 'Menu item is required' using errcode = '22023';
  end if;

  perform private.assert_recipe_yield_factors(
    p_serving_quantity,
    p_prep_yield,
    p_cooking_yield
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f' || 'recipe_version_yield'
        || E'\x1f' || p_menu_item_id::text,
      0
    )
  );

  select true into menu_exists
  from public.menu_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_menu_item_id
  for share;
  if not coalesce(menu_exists, false) then
    raise exception 'Menu item not found for restaurant' using errcode = '23503';
  end if;

  if p_recipe_version_id is not null then
    select * into version_row
    from public.recipe_versions entry
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_recipe_version_id
    for update;
    if not found then
      raise exception 'Recipe version not found for restaurant' using errcode = '23503';
    end if;
    if version_row.menu_item_id is distinct from p_menu_item_id then
      raise exception 'Recipe version does not belong to this menu item'
        using errcode = '22023';
    end if;
    if version_row.pos_location_id is not null then
      raise exception 'Location-specific recipe yields are not editable here'
        using errcode = '22023';
    end if;
    if version_row.status is distinct from 'draft' then
      raise exception 'Only draft recipe yields can be edited' using errcode = '22023';
    end if;

    update public.recipe_versions entry
    set
      serving_quantity = p_serving_quantity,
      prep_yield = p_prep_yield,
      cooking_yield = p_cooking_yield,
      updated_at = now_ts
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_recipe_version_id
    returning * into version_row;
  else
    select * into version_row
    from public.recipe_versions entry
    where entry.restaurant_id = p_restaurant_id
      and entry.menu_item_id = p_menu_item_id
      and entry.pos_location_id is null
      and entry.status = 'draft'
    order by entry.version_number desc, entry.id desc
    limit 1
    for update;

    if found then
      update public.recipe_versions entry
      set
        serving_quantity = p_serving_quantity,
        prep_yield = p_prep_yield,
        cooking_yield = p_cooking_yield,
        updated_at = now_ts
      where entry.restaurant_id = p_restaurant_id
        and entry.id = version_row.id
      returning * into version_row;
    else
      select coalesce(max(entry.version_number), 0) + 1
      into next_version_number
      from public.recipe_versions entry
      where entry.restaurant_id = p_restaurant_id
        and entry.menu_item_id = p_menu_item_id
        and entry.pos_location_id is null;

      insert into public.recipe_versions (
        restaurant_id,
        menu_item_id,
        pos_location_id,
        version_number,
        status,
        serving_quantity,
        prep_yield,
        cooking_yield,
        effective_from,
        effective_to,
        created_at,
        updated_at
      ) values (
        p_restaurant_id,
        p_menu_item_id,
        null,
        next_version_number,
        'draft',
        p_serving_quantity,
        p_prep_yield,
        p_cooking_yield,
        now_ts,
        null,
        now_ts,
        now_ts
      )
      returning * into version_row;
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'recipe_version_yield.upserted',
    'recipe_versions',
    version_row.id,
    pg_catalog.jsonb_build_object(
      'menu_item_id', version_row.menu_item_id,
      'version_number', version_row.version_number,
      'serving_quantity', version_row.serving_quantity,
      'prep_yield', version_row.prep_yield,
      'cooking_yield', version_row.cooking_yield,
      'status', version_row.status
    )
  );

  return version_row;
end;
$$;

create or replace function public.verify_recipe_version_yields(
  p_restaurant_id uuid,
  p_recipe_version_id uuid
)
returns public.recipe_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  version_row public.recipe_versions%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into version_row
  from public.recipe_versions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_recipe_version_id
  for update;
  if not found then
    raise exception 'Recipe version not found for restaurant' using errcode = '23503';
  end if;
  if version_row.pos_location_id is not null then
    raise exception 'Location-specific recipe yields are not editable here'
      using errcode = '22023';
  end if;
  if version_row.status is distinct from 'draft' then
    raise exception 'Only draft recipe yields can be verified' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f' || 'recipe_version_yield'
        || E'\x1f' || version_row.menu_item_id::text,
      0
    )
  );

  perform private.assert_recipe_yield_factors(
    version_row.serving_quantity,
    version_row.prep_yield,
    version_row.cooking_yield
  );

  -- Close prior active restaurant-wide windows so verify never rewrites history
  -- and never overlaps the exclude constraint for non-retired versions.
  update public.recipe_versions prior_entry
  set
    effective_to = now_ts,
    updated_at = now_ts
  where prior_entry.restaurant_id = p_restaurant_id
    and prior_entry.menu_item_id = version_row.menu_item_id
    and prior_entry.pos_location_id is null
    and prior_entry.id <> p_recipe_version_id
    and prior_entry.status <> 'retired'
    and prior_entry.effective_from <= now_ts
    and (prior_entry.effective_to is null or prior_entry.effective_to > now_ts);

  update public.recipe_versions entry
  set
    status = 'verified',
    effective_from = least(entry.effective_from, now_ts),
    effective_to = null,
    verified_at = now_ts,
    verified_by = actor_user_id,
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_recipe_version_id
  returning * into version_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'recipe_version_yield.verified',
    'recipe_versions',
    version_row.id,
    pg_catalog.jsonb_build_object(
      'menu_item_id', version_row.menu_item_id,
      'version_number', version_row.version_number,
      'serving_quantity', version_row.serving_quantity,
      'prep_yield', version_row.prep_yield,
      'cooking_yield', version_row.cooking_yield,
      'verified_at', version_row.verified_at
    )
  );

  return version_row;
end;
$$;

create or replace function public.retire_recipe_version_yields(
  p_restaurant_id uuid,
  p_recipe_version_id uuid
)
returns public.recipe_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  version_row public.recipe_versions%rowtype;
  previous_status text;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into version_row
  from public.recipe_versions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_recipe_version_id
  for update;
  if not found then
    raise exception 'Recipe version not found for restaurant' using errcode = '23503';
  end if;
  if version_row.pos_location_id is not null then
    raise exception 'Location-specific recipe yields are not editable here'
      using errcode = '22023';
  end if;
  if version_row.status = 'retired' then
    raise exception 'Recipe yield version is already retired' using errcode = '22023';
  end if;

  previous_status := version_row.status;

  update public.recipe_versions entry
  set
    status = 'retired',
    effective_to = coalesce(entry.effective_to, now_ts),
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_recipe_version_id
  returning * into version_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'recipe_version_yield.retired',
    'recipe_versions',
    version_row.id,
    pg_catalog.jsonb_build_object(
      'menu_item_id', version_row.menu_item_id,
      'version_number', version_row.version_number,
      'previous_status', previous_status,
      'effective_to', version_row.effective_to
    )
  );

  return version_row;
end;
$$;

revoke all on function private.assert_recipe_yield_factors(numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
grant execute on function private.assert_recipe_yield_factors(numeric, numeric, numeric)
  to postgres, service_role;

revoke all on function public.upsert_recipe_version_yields(
  uuid, uuid, numeric, numeric, numeric, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_recipe_version_yields(
  uuid, uuid, numeric, numeric, numeric, uuid
) to authenticated;

revoke all on function public.verify_recipe_version_yields(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_recipe_version_yields(uuid, uuid)
  to authenticated;

revoke all on function public.retire_recipe_version_yields(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.retire_recipe_version_yields(uuid, uuid)
  to authenticated;

comment on function public.upsert_recipe_version_yields(
  uuid, uuid, numeric, numeric, numeric, uuid
) is
  'Creates or edits a restaurant-wide draft recipe_versions yield row. Authenticated clients cannot write recipe_versions directly. Verified yields are never mutated in place.';

comment on function public.verify_recipe_version_yields(uuid, uuid) is
  'Manager+ verification of draft recipe yields. Closes prior active restaurant-wide windows for the same menu item without rewriting historical rows.';

comment on function public.retire_recipe_version_yields(uuid, uuid) is
  'Manager+ retirement of a draft or verified restaurant-wide recipe yield version.';
