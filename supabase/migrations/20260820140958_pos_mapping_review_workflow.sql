-- MISE-002B: explicit operator review is the only authenticated path that can
-- turn a Square catalog suggestion into an authoritative menu mapping.

create or replace function public.list_pos_catalog_mapping_reviews(
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  review_rows jsonb;
  menu_rows jsonb;
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id,
      array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select coalesce(pg_catalog.jsonb_agg(row_payload order by row_updated_at desc, row_id), '[]'::jsonb)
  into review_rows
  from (
    select
      mapping.id as row_id,
      mapping.updated_at as row_updated_at,
      pg_catalog.jsonb_build_object(
        'id', mapping.id,
        'restaurantId', mapping.restaurant_id,
        'provider', integration.provider,
        'locationId', location.id,
        'providerLocationId', location.external_location_id,
        'locationName', location.display_name,
        'externalCatalogItemId', mapping.external_catalog_item_id,
        'externalVariationId', mapping.external_variation_id,
        'externalName', mapping.external_name,
        'suggestedMenuItemId', mapping.menu_item_id,
        'suggestedMenuItemName', menu_item.name,
        'suggestedMenuItemCategory', menu_item.category,
        'verificationStatus', mapping.verification_status,
        'updatedAt', mapping.updated_at
      ) as row_payload
    from public.pos_catalog_item_mappings mapping
    join public.pos_locations location
      on location.id = mapping.pos_location_id
      and location.restaurant_id = mapping.restaurant_id
      and location.status = 'active'
    join public.pos_integrations integration
      on integration.id = location.pos_integration_id
      and integration.restaurant_id = mapping.restaurant_id
      and integration.provider = 'square'
      and integration.status = 'connected'
    left join public.menu_items menu_item
      on menu_item.id = mapping.menu_item_id
      and menu_item.restaurant_id = mapping.restaurant_id
    where mapping.restaurant_id = p_restaurant_id
      and mapping.verification_status = 'draft'
      and mapping.effective_from <= pg_catalog.now()
      and (mapping.effective_to is null or mapping.effective_to > pg_catalog.now())
    order by mapping.updated_at desc, mapping.id
    limit 100
  ) bounded_reviews;

  select coalesce(pg_catalog.jsonb_agg(row_payload order by row_name, row_id), '[]'::jsonb)
  into menu_rows
  from (
    select
      menu_item.id as row_id,
      menu_item.name as row_name,
      pg_catalog.jsonb_build_object(
        'id', menu_item.id,
        'restaurantId', menu_item.restaurant_id,
        'name', menu_item.name,
        'category', menu_item.category
      ) as row_payload
    from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id
      and menu_item.active = true
    order by menu_item.name, menu_item.id
    limit 200
  ) bounded_menu_items;

  return pg_catalog.jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'mappings', review_rows,
    'menuItems', menu_rows
  );
end;
$$;

comment on function public.list_pos_catalog_mapping_reviews(uuid) is
  'Returns a bounded manager-authorized queue of current Square draft mappings and active same-tenant menu choices. Excludes provider secrets and raw payloads.';

create or replace function public.review_pos_catalog_mapping(
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_menu_item_id uuid,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_decision text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_decision, '')));
  mapping_row public.pos_catalog_item_mappings%rowtype;
  menu_item_row public.menu_items%rowtype;
  reviewable boolean := false;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id,
      array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_mapping_id is null or normalized_decision not in ('verify', 'reject') then
    raise exception 'Mapping review input is invalid' using errcode = '22023';
  end if;
  if normalized_decision = 'verify' and p_menu_item_id is null then
    raise exception 'An active menu item is required to verify a mapping' using errcode = '22023';
  end if;
  if normalized_decision = 'reject' and p_menu_item_id is not null then
    raise exception 'Rejected mappings do not accept a menu item' using errcode = '22023';
  end if;

  select mapping.*
  into mapping_row
  from public.pos_catalog_item_mappings mapping
  where mapping.id = p_mapping_id
    and mapping.restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Mapping is not available for review' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.pos_locations location
    join public.pos_integrations integration
      on integration.id = location.pos_integration_id
      and integration.restaurant_id = location.restaurant_id
      and integration.provider = 'square'
      and integration.status = 'connected'
    where location.id = mapping_row.pos_location_id
      and location.restaurant_id = p_restaurant_id
      and location.status = 'active'
      and mapping_row.effective_from <= pg_catalog.now()
      and (mapping_row.effective_to is null or mapping_row.effective_to > pg_catalog.now())
  ) into reviewable;

  if not reviewable then
    raise exception 'Mapping is not available for review' using errcode = '22023';
  end if;

  if mapping_row.verification_status = 'verified' then
    if normalized_decision = 'verify' and mapping_row.menu_item_id = p_menu_item_id then
      return pg_catalog.jsonb_build_object(
        'outcome', 'already_verified',
        'mappingId', mapping_row.id,
        'restaurantId', mapping_row.restaurant_id,
        'menuItemId', mapping_row.menu_item_id,
        'verificationStatus', mapping_row.verification_status,
        'verifiedAt', mapping_row.verified_at,
        'verifiedBy', mapping_row.verified_by
      );
    end if;
    raise exception 'Mapping has already been reviewed' using errcode = '55000';
  elsif mapping_row.verification_status = 'rejected' then
    if normalized_decision = 'reject' then
      return pg_catalog.jsonb_build_object(
        'outcome', 'already_rejected',
        'mappingId', mapping_row.id,
        'restaurantId', mapping_row.restaurant_id,
        'menuItemId', mapping_row.menu_item_id,
        'verificationStatus', mapping_row.verification_status,
        'verifiedAt', mapping_row.verified_at,
        'verifiedBy', mapping_row.verified_by
      );
    end if;
    raise exception 'Mapping has already been reviewed' using errcode = '55000';
  elsif mapping_row.verification_status <> 'draft' then
    raise exception 'Mapping is not available for review' using errcode = '22023';
  end if;

  if normalized_decision = 'verify' then
    select menu_item.*
    into menu_item_row
    from public.menu_items menu_item
    where menu_item.id = p_menu_item_id
      and menu_item.restaurant_id = p_restaurant_id
      and menu_item.active = true;

    if not found then
      raise exception 'Menu item is not an active item for this restaurant' using errcode = '22023';
    end if;

    update public.pos_catalog_item_mappings mapping
    set
      menu_item_id = menu_item_row.id,
      verification_status = 'verified',
      confidence = 1,
      verified_at = decision_time,
      verified_by = actor_user_id,
      updated_at = decision_time
    where mapping.id = mapping_row.id
      and mapping.restaurant_id = p_restaurant_id
    returning * into mapping_row;

    insert into public.audit_logs (
      restaurant_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_restaurant_id,
      actor_user_id,
      'pos_mapping_verified',
      'pos_catalog_item_mappings',
      mapping_row.id,
      pg_catalog.jsonb_build_object(
        'provider', 'square',
        'menu_item_id', mapping_row.menu_item_id,
        'pos_location_id', mapping_row.pos_location_id,
        'external_catalog_item_id', mapping_row.external_catalog_item_id,
        'external_variation_id', mapping_row.external_variation_id
      )
    );

    return pg_catalog.jsonb_build_object(
      'outcome', 'verified',
      'mappingId', mapping_row.id,
      'restaurantId', mapping_row.restaurant_id,
      'menuItemId', mapping_row.menu_item_id,
      'verificationStatus', mapping_row.verification_status,
      'verifiedAt', mapping_row.verified_at,
      'verifiedBy', mapping_row.verified_by
    );
  end if;

  update public.pos_catalog_item_mappings mapping
  set
    verification_status = 'rejected',
    verified_at = null,
    verified_by = null,
    updated_at = decision_time
  where mapping.id = mapping_row.id
    and mapping.restaurant_id = p_restaurant_id
  returning * into mapping_row;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'pos_mapping_rejected',
    'pos_catalog_item_mappings',
    mapping_row.id,
    pg_catalog.jsonb_build_object(
      'provider', 'square',
      'pos_location_id', mapping_row.pos_location_id,
      'external_catalog_item_id', mapping_row.external_catalog_item_id,
      'external_variation_id', mapping_row.external_variation_id
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'rejected',
    'mappingId', mapping_row.id,
    'restaurantId', mapping_row.restaurant_id,
    'menuItemId', mapping_row.menu_item_id,
    'verificationStatus', mapping_row.verification_status,
    'verifiedAt', mapping_row.verified_at,
    'verifiedBy', mapping_row.verified_by
  );
end;
$$;

comment on function public.review_pos_catalog_mapping(uuid, uuid, uuid, text) is
  'Locks and explicitly verifies or rejects one current Square draft mapping for an owner, admin, or manager. Exact decision replays are idempotent.';

revoke insert, update, delete on table public.pos_catalog_item_mappings from authenticated;

revoke all on function public.list_pos_catalog_mapping_reviews(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.review_pos_catalog_mapping(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.list_pos_catalog_mapping_reviews(uuid)
  to authenticated;
grant execute on function public.review_pos_catalog_mapping(uuid, uuid, uuid, text)
  to authenticated;
