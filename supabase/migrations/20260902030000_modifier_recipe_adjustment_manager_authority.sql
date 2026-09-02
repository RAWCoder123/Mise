-- Manager-facing modifier recipe adjustment authority.
-- Clients never write modifier_recipe_adjustments directly (SELECT-only RLS).
-- These SECURITY DEFINER RPCs are the only authenticated mutation path.
-- Adjustments bind a POS external modifier id to a canonical inventory delta
-- on a restaurant-wide recipe_versions row. Verification is manager+ and auditable.

create or replace function private.ensure_restaurant_wide_recipe_version_for_modifiers(
  p_restaurant_id uuid,
  p_menu_item_id uuid
)
returns public.recipe_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_row public.recipe_versions%rowtype;
  menu_exists boolean := false;
  next_version_number integer;
  now_ts timestamptz := pg_catalog.now();
begin
  if p_menu_item_id is null then
    raise exception 'Menu item is required' using errcode = '22023';
  end if;

  select true into menu_exists
  from public.menu_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_menu_item_id
  for share;
  if not coalesce(menu_exists, false) then
    raise exception 'Menu item not found for restaurant' using errcode = '23503';
  end if;

  -- Prefer an existing draft so modifiers and yields share one editable version.
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
    return version_row;
  end if;

  -- Otherwise attach to the current verified restaurant-wide window.
  select * into version_row
  from public.recipe_versions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.menu_item_id = p_menu_item_id
    and entry.pos_location_id is null
    and entry.status = 'verified'
    and entry.effective_from <= now_ts
    and (entry.effective_to is null or entry.effective_to > now_ts)
  order by entry.version_number desc, entry.id desc
  limit 1
  for update;
  if found then
    return version_row;
  end if;

  -- First version for this dish: default yields of 1 (no invented loss factors).
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
    1,
    1,
    1,
    now_ts,
    null,
    now_ts,
    now_ts
  )
  returning * into version_row;

  return version_row;
end;
$$;

create or replace function private.assert_modifier_recipe_adjustment_item(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_canonical_unit text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
begin
  if p_inventory_item_id is null then
    raise exception 'Inventory item is required' using errcode = '22023';
  end if;

  if p_canonical_unit not in ('g', 'ml', 'each') then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  for share;
  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  if item_row.canonical_unit_verification_status is distinct from 'verified'
    or item_row.canonical_unit is distinct from p_canonical_unit
  then
    raise exception 'Modifier adjustments require a verified matching canonical unit'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_modifier_recipe_adjustment(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_external_modifier_id text,
  p_modifier_name text,
  p_inventory_item_id uuid,
  p_quantity_delta numeric,
  p_canonical_unit text,
  p_adjustment_id uuid default null
)
returns public.modifier_recipe_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  version_row public.recipe_versions%rowtype;
  adjustment_row public.modifier_recipe_adjustments%rowtype;
  safe_modifier_id text;
  safe_modifier_name text;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  safe_modifier_id := nullif(btrim(coalesce(p_external_modifier_id, '')), '');
  safe_modifier_name := nullif(btrim(coalesce(p_modifier_name, '')), '');
  if safe_modifier_id is null or char_length(safe_modifier_id) > 128 then
    raise exception 'External modifier id is invalid' using errcode = '22023';
  end if;
  if safe_modifier_name is null or char_length(safe_modifier_name) > 160 then
    raise exception 'Modifier name is invalid' using errcode = '22023';
  end if;

  if p_quantity_delta is null
    or p_quantity_delta = 0
    or abs(p_quantity_delta) > 1000000
  then
    raise exception 'Modifier quantity delta is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f' || 'modifier_recipe_adjustment'
        || E'\x1f' || coalesce(p_menu_item_id::text, '')
        || E'\x1f' || coalesce(safe_modifier_id, ''),
      0
    )
  );

  version_row := private.ensure_restaurant_wide_recipe_version_for_modifiers(
    p_restaurant_id,
    p_menu_item_id
  );

  perform private.assert_modifier_recipe_adjustment_item(
    p_restaurant_id,
    p_inventory_item_id,
    p_canonical_unit
  );

  if p_adjustment_id is not null then
    select * into adjustment_row
    from public.modifier_recipe_adjustments entry
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_adjustment_id
    for update;
    if not found then
      raise exception 'Modifier recipe adjustment not found for restaurant'
        using errcode = '23503';
    end if;
    if adjustment_row.verification_status is distinct from 'draft' then
      raise exception 'Only draft modifier adjustments can be edited' using errcode = '22023';
    end if;
    if adjustment_row.recipe_version_id is distinct from version_row.id then
      raise exception 'Modifier adjustment does not belong to this menu item version'
        using errcode = '22023';
    end if;

    update public.modifier_recipe_adjustments entry
    set
      external_modifier_id = safe_modifier_id,
      modifier_name = safe_modifier_name,
      inventory_item_id = p_inventory_item_id,
      quantity_delta = p_quantity_delta,
      canonical_unit = p_canonical_unit,
      updated_at = now_ts
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_adjustment_id
    returning * into adjustment_row;
  else
    insert into public.modifier_recipe_adjustments (
      restaurant_id,
      recipe_version_id,
      external_modifier_id,
      modifier_name,
      inventory_item_id,
      quantity_delta,
      canonical_unit,
      verification_status,
      created_at,
      updated_at
    ) values (
      p_restaurant_id,
      version_row.id,
      safe_modifier_id,
      safe_modifier_name,
      p_inventory_item_id,
      p_quantity_delta,
      p_canonical_unit,
      'draft',
      now_ts,
      now_ts
    )
    returning * into adjustment_row;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'modifier_recipe_adjustment.upserted',
    'modifier_recipe_adjustments',
    adjustment_row.id,
    pg_catalog.jsonb_build_object(
      'menu_item_id', version_row.menu_item_id,
      'recipe_version_id', adjustment_row.recipe_version_id,
      'external_modifier_id', adjustment_row.external_modifier_id,
      'modifier_name', adjustment_row.modifier_name,
      'inventory_item_id', adjustment_row.inventory_item_id,
      'quantity_delta', adjustment_row.quantity_delta,
      'canonical_unit', adjustment_row.canonical_unit,
      'verification_status', adjustment_row.verification_status
    )
  );

  return adjustment_row;
end;
$$;

create or replace function public.verify_modifier_recipe_adjustment(
  p_restaurant_id uuid,
  p_adjustment_id uuid
)
returns public.modifier_recipe_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  adjustment_row public.modifier_recipe_adjustments%rowtype;
  version_row public.recipe_versions%rowtype;
  conflicting_id uuid;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into adjustment_row
  from public.modifier_recipe_adjustments entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Modifier recipe adjustment not found for restaurant'
      using errcode = '23503';
  end if;
  if adjustment_row.verification_status is distinct from 'draft' then
    raise exception 'Only draft modifier adjustments can be verified' using errcode = '22023';
  end if;

  select * into version_row
  from public.recipe_versions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = adjustment_row.recipe_version_id
  for share;
  if not found then
    raise exception 'Recipe version not found for restaurant' using errcode = '23503';
  end if;

  perform private.assert_modifier_recipe_adjustment_item(
    p_restaurant_id,
    adjustment_row.inventory_item_id,
    adjustment_row.canonical_unit
  );

  select entry.id into conflicting_id
  from public.modifier_recipe_adjustments entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id <> p_adjustment_id
    and entry.recipe_version_id = adjustment_row.recipe_version_id
    and entry.external_modifier_id = adjustment_row.external_modifier_id
    and entry.inventory_item_id = adjustment_row.inventory_item_id
    and entry.verification_status = 'verified'
  limit 1;
  if conflicting_id is not null then
    raise exception 'An active verified modifier adjustment already exists for this triple'
      using errcode = '23505';
  end if;

  update public.modifier_recipe_adjustments entry
  set
    verification_status = 'verified',
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  returning * into adjustment_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'modifier_recipe_adjustment.verified',
    'modifier_recipe_adjustments',
    adjustment_row.id,
    pg_catalog.jsonb_build_object(
      'menu_item_id', version_row.menu_item_id,
      'recipe_version_id', adjustment_row.recipe_version_id,
      'external_modifier_id', adjustment_row.external_modifier_id,
      'inventory_item_id', adjustment_row.inventory_item_id,
      'quantity_delta', adjustment_row.quantity_delta,
      'canonical_unit', adjustment_row.canonical_unit
    )
  );

  return adjustment_row;
end;
$$;

create or replace function public.reject_modifier_recipe_adjustment(
  p_restaurant_id uuid,
  p_adjustment_id uuid
)
returns public.modifier_recipe_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  adjustment_row public.modifier_recipe_adjustments%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into adjustment_row
  from public.modifier_recipe_adjustments entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Modifier recipe adjustment not found for restaurant'
      using errcode = '23503';
  end if;
  if adjustment_row.verification_status is distinct from 'draft' then
    raise exception 'Only draft modifier adjustments can be rejected' using errcode = '22023';
  end if;

  update public.modifier_recipe_adjustments entry
  set
    verification_status = 'rejected',
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  returning * into adjustment_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'modifier_recipe_adjustment.rejected',
    'modifier_recipe_adjustments',
    adjustment_row.id,
    pg_catalog.jsonb_build_object(
      'recipe_version_id', adjustment_row.recipe_version_id,
      'external_modifier_id', adjustment_row.external_modifier_id,
      'inventory_item_id', adjustment_row.inventory_item_id
    )
  );

  return adjustment_row;
end;
$$;

create or replace function public.expire_modifier_recipe_adjustment(
  p_restaurant_id uuid,
  p_adjustment_id uuid
)
returns public.modifier_recipe_adjustments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  adjustment_row public.modifier_recipe_adjustments%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into adjustment_row
  from public.modifier_recipe_adjustments entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  for update;
  if not found then
    raise exception 'Modifier recipe adjustment not found for restaurant'
      using errcode = '23503';
  end if;
  if adjustment_row.verification_status is distinct from 'verified' then
    raise exception 'Only verified modifier adjustments can be expired' using errcode = '22023';
  end if;

  update public.modifier_recipe_adjustments entry
  set
    verification_status = 'expired',
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_adjustment_id
  returning * into adjustment_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'modifier_recipe_adjustment.expired',
    'modifier_recipe_adjustments',
    adjustment_row.id,
    pg_catalog.jsonb_build_object(
      'recipe_version_id', adjustment_row.recipe_version_id,
      'external_modifier_id', adjustment_row.external_modifier_id,
      'inventory_item_id', adjustment_row.inventory_item_id
    )
  );

  return adjustment_row;
end;
$$;

revoke all on function private.ensure_restaurant_wide_recipe_version_for_modifiers(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.ensure_restaurant_wide_recipe_version_for_modifiers(uuid, uuid)
  to postgres, service_role;

revoke all on function private.assert_modifier_recipe_adjustment_item(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.assert_modifier_recipe_adjustment_item(uuid, uuid, text)
  to postgres, service_role;

revoke all on function public.upsert_modifier_recipe_adjustment(
  uuid, uuid, text, text, uuid, numeric, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_modifier_recipe_adjustment(
  uuid, uuid, text, text, uuid, numeric, text, uuid
) to authenticated;

revoke all on function public.verify_modifier_recipe_adjustment(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_modifier_recipe_adjustment(uuid, uuid)
  to authenticated;

revoke all on function public.reject_modifier_recipe_adjustment(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reject_modifier_recipe_adjustment(uuid, uuid)
  to authenticated;

revoke all on function public.expire_modifier_recipe_adjustment(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.expire_modifier_recipe_adjustment(uuid, uuid)
  to authenticated;

comment on function public.upsert_modifier_recipe_adjustment(
  uuid, uuid, text, text, uuid, numeric, text, uuid
) is
  'Creates or edits a draft POS modifier→inventory delta on a restaurant-wide recipe_versions row. Authenticated clients cannot write modifier_recipe_adjustments directly.';

comment on function public.verify_modifier_recipe_adjustment(uuid, uuid) is
  'Manager+ verification of a draft modifier recipe adjustment. Blocks duplicate verified triples on the same recipe version.';

comment on function public.reject_modifier_recipe_adjustment(uuid, uuid) is
  'Manager+ rejection of a draft modifier recipe adjustment.';

comment on function public.expire_modifier_recipe_adjustment(uuid, uuid) is
  'Manager+ expiration of a verified modifier recipe adjustment.';
