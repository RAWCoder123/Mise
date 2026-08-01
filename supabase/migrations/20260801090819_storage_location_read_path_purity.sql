-- Stop mutating storage locations from the Expo read path.
-- fetchStorageLocations previously called ensure_restaurant_storage_locations,
-- which inserted/reactivated Main as a side effect of listing. Writes already
-- call private.ensure_main_storage_location; reads must stay pure.

create or replace function public.list_restaurant_storage_locations(
  p_restaurant_id uuid
)
returns setof public.storage_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  return query
  select *
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and is_active = true
  order by sort_order asc, name asc;
end;
$$;

revoke all on function public.list_restaurant_storage_locations(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_restaurant_storage_locations(uuid)
  to authenticated;

comment on function public.list_restaurant_storage_locations(uuid) is
  'Read-only active storage locations for a restaurant member. Does not create defaults.';

-- Keep ensure for SQL/admin callers that still need an explicit seed helper, but
-- revoke authenticated Data API execute so Expo cannot mutate via a list call.
revoke all on function public.ensure_restaurant_storage_locations(uuid)
  from public, anon, authenticated, service_role;

comment on function public.ensure_restaurant_storage_locations(uuid) is
  'Legacy ensure+list helper. Authenticated execute is revoked; reads use list_restaurant_storage_locations and writes call private.ensure_main_storage_location.';

-- Seed Main during restaurant create so the first inventory read is not empty
-- solely because no transfer/create has run yet. This remains a write path.
create or replace function private.service_create_restaurant_with_owner(
  p_actor_user_id uuid,
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := p_actor_user_id;
  new_restaurant public.restaurants;
  lifetime_workspace_count integer;
  normalized_name text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = actor_user_id) then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized_name := trim(coalesce(restaurant_name, ''));
  if length(normalized_name) not between 1 and 120 then
    raise exception 'Restaurant name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || E'\x1fowner-workspace-quota', 0)
  );
  select count(*)::integer into lifetime_workspace_count
  from private.restaurant_workspace_allocations allocation
  where allocation.creator_user_id = actor_user_id;
  if lifetime_workspace_count >= 5 then
    raise exception 'A user may create at most five restaurant workspaces' using errcode = '54000';
  end if;

  insert into public.restaurants (name, cuisine_type)
  values (normalized_name, nullif(trim(coalesce(restaurant_cuisine_type, '')), ''))
  returning * into new_restaurant;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (new_restaurant.id, actor_user_id, 'owner', 'active');

  insert into private.restaurant_workspace_allocations (restaurant_id, creator_user_id)
  values (new_restaurant.id, actor_user_id);

  perform private.ensure_main_storage_location(new_restaurant.id);

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    new_restaurant.id,
    actor_user_id,
    'restaurant_created',
    'restaurants',
    new_restaurant.id,
    jsonb_build_object(
      'source', 'service_create_restaurant_with_owner',
      'name', new_restaurant.name
    )
  );

  return new_restaurant;
end;
$$;

revoke all on function private.service_create_restaurant_with_owner(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function private.service_create_restaurant_with_owner(uuid, text, text)
  to service_role;
