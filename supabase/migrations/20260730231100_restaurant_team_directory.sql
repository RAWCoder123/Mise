-- Restaurant team directory for private-beta operators.
--
-- Owners/admins/managers can list their restaurant roster with safe display
-- fields. Membership mutations remain RPC-only; adding by email looks up an
-- existing Auth user without exposing cross-tenant profile browsing.

create or replace function public.list_restaurant_members(
  p_restaurant_id uuid
)
returns table (
  id uuid,
  restaurant_id uuid,
  user_id uuid,
  role text,
  status text,
  display_name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null then
    raise exception 'Restaurant is required' using errcode = '22023';
  end if;

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active';

  if actor_role is null or actor_role not in ('owner', 'admin', 'manager') then
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  return query
  select
    membership.id,
    membership.restaurant_id,
    membership.user_id,
    membership.role,
    membership.status,
    coalesce(
      nullif(pg_catalog.btrim(profile.name), ''),
      nullif(pg_catalog.split_part(coalesce(auth_user.email, profile.email, ''), '@', 1), ''),
      'Operator'
    ) as display_name,
    coalesce(auth_user.email, profile.email, '') as email,
    membership.created_at,
    membership.updated_at
  from public.restaurant_memberships membership
  left join public.users profile
    on profile.id = membership.user_id
  left join auth.users auth_user
    on auth_user.id = membership.user_id
  where membership.restaurant_id = p_restaurant_id
  order by
    case membership.role
      when 'owner' then 0
      when 'admin' then 1
      when 'manager' then 2
      else 3
    end,
    case membership.status
      when 'active' then 0
      when 'invited' then 1
      else 2
    end,
    coalesce(auth_user.email, profile.email, membership.user_id::text);
end;
$$;

create or replace function public.add_restaurant_member_by_email(
  p_restaurant_id uuid,
  p_email text,
  p_role text
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  normalized_email text;
  target_user_id uuid;
  target_name text;
  created_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null then
    raise exception 'Restaurant is required' using errcode = '22023';
  end if;

  normalized_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  if pg_catalog.length(normalized_email) < 3
    or pg_catalog.length(normalized_email) > 254
    or normalized_email ~ '[[:cntrl:]]'
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'Membership email is invalid' using errcode = '22023';
  end if;
  if p_role is null or p_role not in ('admin', 'manager', 'staff') then
    raise exception 'New memberships must use admin, manager, or staff' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active'
  for update;

  if actor_role = 'owner' then
    null;
  elsif actor_role = 'admin' and p_role in ('manager', 'staff') then
    null;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  select auth_user.id, coalesce(nullif(pg_catalog.btrim(profile.name), ''), pg_catalog.split_part(normalized_email, '@', 1), 'Operator')
    into target_user_id, target_name
  from auth.users auth_user
  left join public.users profile on profile.id = auth_user.id
  where pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;
  if target_user_id = actor_user_id then
    raise exception 'Membership target is not allowed' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = target_user_id
  ) then
    raise exception 'Membership already exists' using errcode = '23505';
  end if;

  insert into public.users (id, restaurant_id, name, email, role)
  values (target_user_id, p_restaurant_id, target_name, normalized_email, p_role)
  on conflict (id) do update
    set
      name = coalesce(nullif(pg_catalog.btrim(public.users.name), ''), excluded.name),
      email = excluded.email
  where public.users.email is distinct from excluded.email
     or coalesce(nullif(pg_catalog.btrim(public.users.name), ''), '') = '';

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (p_restaurant_id, target_user_id, p_role, 'active')
  returning * into created_membership;

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
    'restaurant_member_added',
    'restaurant_memberships',
    created_membership.id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'role', p_role,
      'status', 'active'
    )
  );

  return created_membership;
end;
$$;

create or replace function public.update_restaurant_member(
  p_restaurant_id uuid,
  p_target_user_id uuid,
  p_role text default null,
  p_status text default null
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  target_membership public.restaurant_memberships;
  next_role text;
  next_status text;
  updated_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = actor_user_id then
    raise exception 'Self-membership changes are not allowed' using errcode = '42501';
  end if;
  if p_role is null and p_status is null then
    raise exception 'A membership role or status change is required' using errcode = '22023';
  end if;
  if p_role is not null and p_role not in ('owner', 'admin', 'manager', 'staff') then
    raise exception 'Membership role is invalid' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('active', 'disabled') then
    raise exception 'Membership status is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active'
  for update;

  select membership.* into target_membership
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_target_user_id
  for update;
  if not found then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;
  if target_membership.status = 'invited' then
    raise exception 'Invitations require a trusted invitation workflow' using errcode = '42501';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'Owners cannot be changed by a client' using errcode = '42501';
  end if;

  next_role := coalesce(p_role, target_membership.role);
  next_status := coalesce(p_status, target_membership.status);

  if actor_role = 'owner' then
    if next_role = 'owner' and (
      target_membership.status <> 'active' or next_status <> 'active'
    ) then
      raise exception 'Only an active member can be promoted to owner' using errcode = '22023';
    end if;
  elsif actor_role = 'admin' then
    if target_membership.role not in ('manager', 'staff')
      or next_role not in ('manager', 'staff')
    then
      raise exception 'Admins may manage only manager and staff memberships' using errcode = '42501';
    end if;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  update public.restaurant_memberships membership
  set role = next_role,
      status = next_status
  where membership.id = target_membership.id
  returning * into updated_membership;

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
    'restaurant_member_updated',
    'restaurant_memberships',
    updated_membership.id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'previous_role', target_membership.role,
      'previous_status', target_membership.status,
      'role', updated_membership.role,
      'status', updated_membership.status
    )
  );

  return updated_membership;
end;
$$;

create or replace function public.remove_restaurant_member(
  p_restaurant_id uuid,
  p_target_user_id uuid
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  target_membership public.restaurant_memberships;
  removed_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = actor_user_id then
    raise exception 'Self-membership changes are not allowed' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active'
  for update;

  select membership.* into target_membership
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_target_user_id
  for update;
  if not found then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;
  if target_membership.status = 'invited' then
    raise exception 'Invitations require a trusted invitation workflow' using errcode = '42501';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'Owners cannot be removed by a client' using errcode = '42501';
  end if;
  if actor_role = 'owner' then
    null;
  elsif actor_role = 'admin' and target_membership.role in ('manager', 'staff') then
    null;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  delete from public.restaurant_memberships membership
  where membership.id = target_membership.id
  returning * into removed_membership;

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
    'restaurant_member_removed',
    'restaurant_memberships',
    removed_membership.id,
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'role', removed_membership.role,
      'status', removed_membership.status
    )
  );

  return removed_membership;
end;
$$;

revoke all on function public.list_restaurant_members(uuid) from public, anon, authenticated, service_role;
revoke all on function public.add_restaurant_member_by_email(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_member(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.remove_restaurant_member(uuid, uuid) from public, anon, authenticated, service_role;

grant execute on function public.list_restaurant_members(uuid) to authenticated;
grant execute on function public.add_restaurant_member_by_email(uuid, text, text) to authenticated;
grant execute on function public.update_restaurant_member(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_restaurant_member(uuid, uuid) to authenticated;

comment on function public.list_restaurant_members(uuid) is
  'Returns the restaurant membership roster with safe display fields for active owners, admins, and managers.';
comment on function public.add_restaurant_member_by_email(uuid, text, text) is
  'Adds an existing Auth user to a restaurant by email through owner/admin membership authority.';
