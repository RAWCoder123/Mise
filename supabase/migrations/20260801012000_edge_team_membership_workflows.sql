-- Route restaurant team membership mutations through service-owned RPCs so
-- authenticated clients must use operational-workflows (Edge firewall + audit).
-- Invite claim remains an auth.uid()-bound authenticated RPC because the caller
-- is not yet a restaurant member and cannot reserve operational-workflows.

create or replace function private.service_add_restaurant_member(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_target_user_id uuid,
  p_role text
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  created_membership public.restaurant_memberships;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = p_actor_user_id then
    raise exception 'Membership target is not allowed' using errcode = '42501';
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
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  for update;

  if actor_role = 'owner' then
    null;
  elsif actor_role = 'admin' and p_role in ('manager', 'staff') then
    null;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users auth_user where auth_user.id = p_target_user_id) then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = p_target_user_id
  ) then
    raise exception 'Membership already exists' using errcode = '23505';
  end if;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (p_restaurant_id, p_target_user_id, p_role, 'active')
  returning * into created_membership;


  return created_membership;
end;
$$;

revoke all on function private.service_add_restaurant_member(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.service_add_restaurant_member(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.service_add_restaurant_member(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_target_user_id uuid,
  p_role text
)
returns public.restaurant_memberships
language sql
security invoker
set search_path = ''
as $$
  select private.service_add_restaurant_member(
    p_actor_user_id,
    p_restaurant_id,
    p_target_user_id,
    p_role
  );
$$;

revoke all on function public.service_add_restaurant_member(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_add_restaurant_member(uuid, uuid, uuid, text)
  to service_role;

comment on function public.service_add_restaurant_member(uuid, uuid, uuid, text) is
  'Service-owned member add by user id. Authenticated clients must call through operational-workflows.';

create or replace function private.service_add_restaurant_member_by_email(
  p_actor_user_id uuid,
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
  actor_role text;
  normalized_email text;
  target_user_id uuid;
  target_name text;
  created_membership public.restaurant_memberships;
begin
  if p_actor_user_id is null then
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
    and membership.user_id = p_actor_user_id
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
  if target_user_id = p_actor_user_id then
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


  return created_membership;
end;
$$;

revoke all on function private.service_add_restaurant_member_by_email(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function private.service_add_restaurant_member_by_email(uuid, uuid, text, text)
  to service_role;

create or replace function public.service_add_restaurant_member_by_email(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_email text,
  p_role text
)
returns public.restaurant_memberships
language sql
security invoker
set search_path = ''
as $$
  select private.service_add_restaurant_member_by_email(
    p_actor_user_id,
    p_restaurant_id,
    p_email,
    p_role
  );
$$;

revoke all on function public.service_add_restaurant_member_by_email(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_add_restaurant_member_by_email(uuid, uuid, text, text)
  to service_role;

comment on function public.service_add_restaurant_member_by_email(uuid, uuid, text, text) is
  'Service-owned member add by email. Authenticated clients must call through operational-workflows.';

create or replace function private.service_update_restaurant_member(
  p_actor_user_id uuid,
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
  actor_role text;
  target_membership public.restaurant_memberships;
  next_role text;
  next_status text;
  updated_membership public.restaurant_memberships;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = p_actor_user_id then
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
    and membership.user_id = p_actor_user_id
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


  return updated_membership;
end;
$$;

revoke all on function private.service_update_restaurant_member(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function private.service_update_restaurant_member(uuid, uuid, uuid, text, text)
  to service_role;

create or replace function public.service_update_restaurant_member(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_target_user_id uuid,
  p_role text default null,
  p_status text default null
)
returns public.restaurant_memberships
language sql
security invoker
set search_path = ''
as $$
  select private.service_update_restaurant_member(
    p_actor_user_id,
    p_restaurant_id,
    p_target_user_id,
    p_role,
    p_status
  );
$$;

revoke all on function public.service_update_restaurant_member(uuid, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_restaurant_member(uuid, uuid, uuid, text, text)
  to service_role;

comment on function public.service_update_restaurant_member(uuid, uuid, uuid, text, text) is
  'Service-owned member update. Authenticated clients must call through operational-workflows.';

create or replace function private.service_remove_restaurant_member(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_target_user_id uuid
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_membership public.restaurant_memberships;
  removed_membership public.restaurant_memberships;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = p_actor_user_id then
    raise exception 'Self-membership changes are not allowed' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_actor_user_id
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


  return removed_membership;
end;
$$;

revoke all on function private.service_remove_restaurant_member(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.service_remove_restaurant_member(uuid, uuid, uuid)
  to service_role;

create or replace function public.service_remove_restaurant_member(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_target_user_id uuid
)
returns public.restaurant_memberships
language sql
security invoker
set search_path = ''
as $$
  select private.service_remove_restaurant_member(
    p_actor_user_id,
    p_restaurant_id,
    p_target_user_id
  );
$$;

revoke all on function public.service_remove_restaurant_member(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_remove_restaurant_member(uuid, uuid, uuid)
  to service_role;

comment on function public.service_remove_restaurant_member(uuid, uuid, uuid) is
  'Service-owned member remove. Authenticated clients must call through operational-workflows.';

create or replace function private.service_create_restaurant_member_invite(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_email text,
  p_role text,
  p_expires_in_hours integer default 168
)
returns table (
  id uuid,
  restaurant_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  claim_token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  normalized_email text;
  expires_hours integer;
  next_expires_at timestamptz;
  raw_token text;
  next_token_hash text;
  created_invite public.restaurant_member_invites;
begin
  if p_actor_user_id is null then
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

  expires_hours := coalesce(p_expires_in_hours, 168);
  if expires_hours < 1 or expires_hours > 720 then
    raise exception 'Invite expiry is invalid' using errcode = '22023';
  end if;
  next_expires_at := pg_catalog.now() + make_interval(hours => expires_hours);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  for update;

  if actor_role = 'owner' then
    null;
  elsif actor_role = 'admin' and p_role in ('manager', 'staff') then
    null;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  if exists (
    select 1
    from auth.users auth_user
    join public.restaurant_memberships membership
      on membership.user_id = auth_user.id
     and membership.restaurant_id = p_restaurant_id
    where pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = normalized_email
  ) then
    raise exception 'Membership already exists' using errcode = '23505';
  end if;

  update public.restaurant_member_invites invite
  set status = 'revoked',
      revoked_at = pg_catalog.now()
  where invite.restaurant_id = p_restaurant_id
    and invite.email = normalized_email
    and invite.status = 'pending';

  raw_token := pg_catalog.replace(
    pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,
    '-',
    ''
  );
  next_token_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(raw_token, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.restaurant_member_invites (
    restaurant_id,
    email,
    role,
    status,
    token_hash,
    created_by,
    expires_at
  ) values (
    p_restaurant_id,
    normalized_email,
    p_role,
    'pending',
    next_token_hash,
    p_actor_user_id,
    next_expires_at
  )
  returning * into created_invite;


  return query
  select
    created_invite.id,
    created_invite.restaurant_id,
    created_invite.email,
    created_invite.role,
    created_invite.status,
    created_invite.expires_at,
    created_invite.created_at,
    raw_token;
end;
$$;

revoke all on function private.service_create_restaurant_member_invite(uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function private.service_create_restaurant_member_invite(uuid, uuid, text, text, integer)
  to service_role;

create or replace function public.service_create_restaurant_member_invite(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_email text,
  p_role text,
  p_expires_in_hours integer default 168
)
returns table (
  id uuid,
  restaurant_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  claim_token text
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.service_create_restaurant_member_invite(
    p_actor_user_id,
    p_restaurant_id,
    p_email,
    p_role,
    p_expires_in_hours
  );
$$;

revoke all on function public.service_create_restaurant_member_invite(uuid, uuid, text, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.service_create_restaurant_member_invite(uuid, uuid, text, text, integer)
  to service_role;

comment on function public.service_create_restaurant_member_invite(uuid, uuid, text, text, integer) is
  'Service-owned member invite create. Authenticated clients must call through operational-workflows.';

create or replace function private.service_revoke_restaurant_member_invite(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_invite_id uuid
)
returns public.restaurant_member_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_invite public.restaurant_member_invites;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_invite_id is null then
    raise exception 'Invite is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
  for update;

  select invite.* into target_invite
  from public.restaurant_member_invites invite
  where invite.id = p_invite_id
    and invite.restaurant_id = p_restaurant_id
  for update;
  if not found then
    raise exception 'Invite is unavailable' using errcode = 'P0002';
  end if;
  if target_invite.status <> 'pending' then
    raise exception 'Only pending invites can be revoked' using errcode = '22023';
  end if;

  if actor_role = 'owner' then
    null;
  elsif actor_role = 'admin' and target_invite.role in ('manager', 'staff') then
    null;
  else
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  update public.restaurant_member_invites invite
  set status = 'revoked',
      revoked_at = pg_catalog.now()
  where invite.id = target_invite.id
  returning * into target_invite;


  return target_invite;
end;
$$;

revoke all on function private.service_revoke_restaurant_member_invite(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.service_revoke_restaurant_member_invite(uuid, uuid, uuid)
  to service_role;

create or replace function public.service_revoke_restaurant_member_invite(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_invite_id uuid
)
returns public.restaurant_member_invites
language sql
security invoker
set search_path = ''
as $$
  select private.service_revoke_restaurant_member_invite(
    p_actor_user_id,
    p_restaurant_id,
    p_invite_id
  );
$$;

revoke all on function public.service_revoke_restaurant_member_invite(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_revoke_restaurant_member_invite(uuid, uuid, uuid)
  to service_role;

comment on function public.service_revoke_restaurant_member_invite(uuid, uuid, uuid) is
  'Service-owned member invite revoke. Authenticated clients must call through operational-workflows.';

-- Keep auth.uid()-bound RPCs for SQL/pgTAP callers that still use them through
-- elevated roles, but revoke Data API execute so Expo cannot bypass Edge.
revoke all on function public.add_restaurant_member(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.add_restaurant_member_by_email(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_member(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.remove_restaurant_member(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_restaurant_member_invite(uuid, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_restaurant_member_invite(uuid, uuid)
  from public, anon, authenticated, service_role;

-- Invite claim remains authenticated: token + matching Auth email authorize the
-- caller before they have restaurant membership for Edge reservation.
comment on function public.claim_restaurant_member_invite(text) is
  'Claims a hashed invite token for the authenticated Auth email. Remains a direct authenticated RPC because the caller is not yet a restaurant member.';
