-- Manager-facing ingredient substitution authority.
-- Clients never write ingredient_substitutions directly (SELECT-only RLS).
-- These SECURITY DEFINER RPCs are the only authenticated mutation path.
-- Substitutions bind verified same-canonical-unit inventory items with an
-- explicit ratio; verification is manager+ and auditable.

create or replace function private.assert_ingredient_substitution_items(
  p_restaurant_id uuid,
  p_source_inventory_item_id uuid,
  p_substitute_inventory_item_id uuid,
  p_canonical_unit text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.inventory_items%rowtype;
  substitute_row public.inventory_items%rowtype;
begin
  if p_source_inventory_item_id is null
    or p_substitute_inventory_item_id is null
    or p_source_inventory_item_id = p_substitute_inventory_item_id
  then
    raise exception 'Substitution items must be distinct' using errcode = '22023';
  end if;

  if p_canonical_unit not in ('g', 'ml', 'each') then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;

  select * into source_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_source_inventory_item_id
  for share;
  if not found then
    raise exception 'Source inventory item not found for restaurant' using errcode = '23503';
  end if;

  select * into substitute_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_substitute_inventory_item_id
  for share;
  if not found then
    raise exception 'Substitute inventory item not found for restaurant' using errcode = '23503';
  end if;

  if source_row.canonical_unit_verification_status is distinct from 'verified'
    or substitute_row.canonical_unit_verification_status is distinct from 'verified'
    or source_row.canonical_unit is distinct from p_canonical_unit
    or substitute_row.canonical_unit is distinct from p_canonical_unit
  then
    raise exception 'Substitution requires verified matching canonical units'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_ingredient_substitution(
  p_restaurant_id uuid,
  p_source_inventory_item_id uuid,
  p_substitute_inventory_item_id uuid,
  p_source_quantity numeric,
  p_substitute_quantity numeric,
  p_canonical_unit text,
  p_substitution_id uuid default null
)
returns public.ingredient_substitutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  substitution_row public.ingredient_substitutions%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if p_source_quantity is null
    or p_substitute_quantity is null
    or p_source_quantity <= 0
    or p_substitute_quantity <= 0
    or p_source_quantity > 1000000
    or p_substitute_quantity > 1000000
  then
    raise exception 'Substitution quantities are invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f' || 'ingredient_substitution'
        || E'\x1f' || coalesce(p_source_inventory_item_id::text, '')
        || E'\x1f' || coalesce(p_substitute_inventory_item_id::text, ''),
      0
    )
  );

  perform private.assert_ingredient_substitution_items(
    p_restaurant_id,
    p_source_inventory_item_id,
    p_substitute_inventory_item_id,
    p_canonical_unit
  );

  if p_substitution_id is not null then
    select * into substitution_row
    from public.ingredient_substitutions entry
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_substitution_id
    for update;
    if not found then
      raise exception 'Ingredient substitution not found for restaurant'
        using errcode = '23503';
    end if;
    if substitution_row.verification_status is distinct from 'draft' then
      raise exception 'Only draft substitutions can be edited' using errcode = '22023';
    end if;

    update public.ingredient_substitutions entry
    set
      source_inventory_item_id = p_source_inventory_item_id,
      substitute_inventory_item_id = p_substitute_inventory_item_id,
      source_quantity = p_source_quantity,
      substitute_quantity = p_substitute_quantity,
      canonical_unit = p_canonical_unit,
      updated_at = now_ts
    where entry.restaurant_id = p_restaurant_id
      and entry.id = p_substitution_id
    returning * into substitution_row;
  else
    insert into public.ingredient_substitutions (
      restaurant_id,
      source_inventory_item_id,
      substitute_inventory_item_id,
      source_quantity,
      substitute_quantity,
      canonical_unit,
      verification_status,
      effective_from,
      created_at,
      updated_at
    ) values (
      p_restaurant_id,
      p_source_inventory_item_id,
      p_substitute_inventory_item_id,
      p_source_quantity,
      p_substitute_quantity,
      p_canonical_unit,
      'draft',
      now_ts,
      now_ts,
      now_ts
    )
    returning * into substitution_row;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'ingredient_substitution.upserted',
    'ingredient_substitutions',
    substitution_row.id,
    pg_catalog.jsonb_build_object(
      'source_inventory_item_id', substitution_row.source_inventory_item_id,
      'substitute_inventory_item_id', substitution_row.substitute_inventory_item_id,
      'source_quantity', substitution_row.source_quantity,
      'substitute_quantity', substitution_row.substitute_quantity,
      'canonical_unit', substitution_row.canonical_unit,
      'verification_status', substitution_row.verification_status
    )
  );

  return substitution_row;
end;
$$;

create or replace function public.verify_ingredient_substitution(
  p_restaurant_id uuid,
  p_substitution_id uuid
)
returns public.ingredient_substitutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  substitution_row public.ingredient_substitutions%rowtype;
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

  select * into substitution_row
  from public.ingredient_substitutions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  for update;
  if not found then
    raise exception 'Ingredient substitution not found for restaurant'
      using errcode = '23503';
  end if;
  if substitution_row.verification_status is distinct from 'draft' then
    raise exception 'Only draft substitutions can be verified' using errcode = '22023';
  end if;

  perform private.assert_ingredient_substitution_items(
    p_restaurant_id,
    substitution_row.source_inventory_item_id,
    substitution_row.substitute_inventory_item_id,
    substitution_row.canonical_unit
  );

  select entry.id into conflicting_id
  from public.ingredient_substitutions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id <> p_substitution_id
    and entry.source_inventory_item_id = substitution_row.source_inventory_item_id
    and entry.substitute_inventory_item_id = substitution_row.substitute_inventory_item_id
    and entry.verification_status = 'verified'
    and entry.effective_from <= now_ts
    and (entry.effective_to is null or entry.effective_to > now_ts)
  limit 1;
  if conflicting_id is not null then
    raise exception 'An active verified substitution already exists for this pair'
      using errcode = '23505';
  end if;

  update public.ingredient_substitutions entry
  set
    verification_status = 'verified',
    verified_at = now_ts,
    verified_by = actor_user_id,
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  returning * into substitution_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'ingredient_substitution.verified',
    'ingredient_substitutions',
    substitution_row.id,
    pg_catalog.jsonb_build_object(
      'source_inventory_item_id', substitution_row.source_inventory_item_id,
      'substitute_inventory_item_id', substitution_row.substitute_inventory_item_id,
      'source_quantity', substitution_row.source_quantity,
      'substitute_quantity', substitution_row.substitute_quantity,
      'canonical_unit', substitution_row.canonical_unit
    )
  );

  return substitution_row;
end;
$$;

create or replace function public.reject_ingredient_substitution(
  p_restaurant_id uuid,
  p_substitution_id uuid
)
returns public.ingredient_substitutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  substitution_row public.ingredient_substitutions%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into substitution_row
  from public.ingredient_substitutions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  for update;
  if not found then
    raise exception 'Ingredient substitution not found for restaurant'
      using errcode = '23503';
  end if;
  if substitution_row.verification_status is distinct from 'draft' then
    raise exception 'Only draft substitutions can be rejected' using errcode = '22023';
  end if;

  update public.ingredient_substitutions entry
  set
    verification_status = 'rejected',
    verified_at = now_ts,
    verified_by = actor_user_id,
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  returning * into substitution_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'ingredient_substitution.rejected',
    'ingredient_substitutions',
    substitution_row.id,
    pg_catalog.jsonb_build_object(
      'source_inventory_item_id', substitution_row.source_inventory_item_id,
      'substitute_inventory_item_id', substitution_row.substitute_inventory_item_id
    )
  );

  return substitution_row;
end;
$$;

create or replace function public.expire_ingredient_substitution(
  p_restaurant_id uuid,
  p_substitution_id uuid
)
returns public.ingredient_substitutions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  substitution_row public.ingredient_substitutions%rowtype;
  now_ts timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select * into substitution_row
  from public.ingredient_substitutions entry
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  for update;
  if not found then
    raise exception 'Ingredient substitution not found for restaurant'
      using errcode = '23503';
  end if;
  if substitution_row.verification_status is distinct from 'verified' then
    raise exception 'Only verified substitutions can be expired' using errcode = '22023';
  end if;

  update public.ingredient_substitutions entry
  set
    verification_status = 'expired',
    effective_to = now_ts,
    updated_at = now_ts
  where entry.restaurant_id = p_restaurant_id
    and entry.id = p_substitution_id
  returning * into substitution_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'ingredient_substitution.expired',
    'ingredient_substitutions',
    substitution_row.id,
    pg_catalog.jsonb_build_object(
      'source_inventory_item_id', substitution_row.source_inventory_item_id,
      'substitute_inventory_item_id', substitution_row.substitute_inventory_item_id,
      'effective_to', substitution_row.effective_to
    )
  );

  return substitution_row;
end;
$$;

revoke all on function private.assert_ingredient_substitution_items(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.assert_ingredient_substitution_items(uuid, uuid, uuid, text)
  to postgres, service_role;

revoke all on function public.upsert_ingredient_substitution(
  uuid, uuid, uuid, numeric, numeric, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.upsert_ingredient_substitution(
  uuid, uuid, uuid, numeric, numeric, text, uuid
) to authenticated;

revoke all on function public.verify_ingredient_substitution(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_ingredient_substitution(uuid, uuid)
  to authenticated;

revoke all on function public.reject_ingredient_substitution(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reject_ingredient_substitution(uuid, uuid)
  to authenticated;

revoke all on function public.expire_ingredient_substitution(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.expire_ingredient_substitution(uuid, uuid)
  to authenticated;

comment on function public.upsert_ingredient_substitution(
  uuid, uuid, uuid, numeric, numeric, text, uuid
) is
  'Creates or edits a draft ingredient substitution ratio between verified same-unit inventory items. Authenticated clients cannot write ingredient_substitutions directly.';

comment on function public.verify_ingredient_substitution(uuid, uuid) is
  'Manager+ verification of a draft ingredient substitution. Blocks overlapping active verified pairs for the same source/substitute.';

comment on function public.reject_ingredient_substitution(uuid, uuid) is
  'Manager+ rejection of a draft ingredient substitution.';

comment on function public.expire_ingredient_substitution(uuid, uuid) is
  'Manager+ expiration of a verified ingredient substitution, closing its effective window.';
