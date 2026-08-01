-- Route pre-membership onboarding mutations (create restaurant, claim invite)
-- through a user-scoped Edge Function with per-user rate limiting.
-- Authenticated clients previously called these RPCs directly and bypassed
-- Edge reservation / security-event ownership.

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales',
      'generate-ai-insights',
      'link-gmail',
      'gmail-oauth-callback',
      'send-supplier-email',
      'operational-workflows',
      'account-onboarding'
    )
  );

create or replace function private.edge_function_policy(p_function_name text)
returns table (max_attempts integer, window_seconds integer, allowed_roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select policy.max_attempts, policy.window_seconds, policy.allowed_roles
  from (
    values
      ('sync-pos-sales', 8, 60, array['owner', 'admin', 'manager']::text[]),
      ('generate-ai-insights', 6, 300, array['owner', 'admin', 'manager']::text[]),
      ('link-gmail', 4, 300, array['owner', 'admin']::text[]),
      ('gmail-oauth-callback', 4, 300, array['owner', 'admin']::text[]),
      ('send-supplier-email', 12, 60, array['owner', 'admin', 'manager']::text[]),
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager', 'staff']::text[]),
      -- User-scoped: roles unused; reservation RPC authenticates by actor id only.
      ('account-onboarding', 12, 60, array[]::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated, service_role;

create or replace function public.reserve_user_scoped_edge_function_invocation(
  p_actor_user_id uuid,
  p_function_name text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_policy record;
  attempt_count integer;
  reservation_id uuid;
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
begin
  if p_actor_user_id is null then
    raise exception 'Missing invocation authority' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_metadata) <> 'object' or octet_length(safe_metadata::text) > 8192 then
    raise exception 'Metadata must be a bounded JSON object' using errcode = '22023';
  end if;
  if nullif(trim(action_name), '') is null or length(action_name) > 160 then
    raise exception 'Invalid invocation action' using errcode = '22023';
  end if;

  select * into current_policy from private.edge_function_policy(p_function_name);
  if not found then
    raise exception 'Unsupported function' using errcode = '22023';
  end if;
  if p_function_name <> 'account-onboarding' then
    raise exception 'Function is not user-scoped' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users auth_user where auth_user.id = p_actor_user_id) then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_actor_user_id::text || E'\x1f' || p_function_name || E'\x1fuser-scoped',
    0
  ));

  select count(*)::integer into attempt_count
  from private.edge_function_security_events events
  where events.actor_user_id = p_actor_user_id
    and events.function_name = p_function_name
    and events.restaurant_id is null
    and events.created_at >= now() - make_interval(secs => current_policy.window_seconds)
    and events.event_type in ('allowed', 'rate_limited');

  if attempt_count >= current_policy.max_attempts then
    insert into private.edge_function_security_events (
      restaurant_id, actor_user_id, function_name, event_type, action, metadata
    ) values (
      null,
      p_actor_user_id,
      p_function_name,
      'rate_limited',
      trim(action_name),
      safe_metadata || jsonb_build_object(
        'window_seconds', current_policy.window_seconds,
        'max_attempts', current_policy.max_attempts,
        'scope', 'user'
      )
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', current_policy.window_seconds
    );
  end if;

  insert into private.edge_function_security_events (
    restaurant_id, actor_user_id, function_name, event_type, action, metadata
  ) values (
    null,
    p_actor_user_id,
    p_function_name,
    'allowed',
    trim(action_name),
    safe_metadata || jsonb_build_object('scope', 'user')
  ) returning id into reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', reservation_id,
    'remaining', greatest(current_policy.max_attempts - attempt_count - 1, 0),
    'window_seconds', current_policy.window_seconds
  );
end;
$$;

revoke all on function public.reserve_user_scoped_edge_function_invocation(uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.reserve_user_scoped_edge_function_invocation(uuid, text, text, jsonb)
  to service_role;

create or replace function public.record_user_scoped_edge_function_security_event(
  p_actor_user_id uuid,
  p_reservation_id uuid,
  p_function_name text,
  p_event_type text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
  reservation_row private.edge_function_security_events%rowtype;
begin
  if p_event_type not in ('blocked', 'completed', 'error') then
    raise exception 'Unsupported security event type' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_metadata) <> 'object' or octet_length(safe_metadata::text) > 8192 then
    raise exception 'Metadata must be a bounded JSON object' using errcode = '22023';
  end if;
  if nullif(trim(action_name), '') is null or length(action_name) > 160 then
    raise exception 'Invalid security event action' using errcode = '22023';
  end if;
  if p_function_name <> 'account-onboarding' then
    raise exception 'Function is not user-scoped' using errcode = '22023';
  end if;

  select * into reservation_row
  from private.edge_function_security_events
  where id = p_reservation_id
    and restaurant_id is null
    and actor_user_id = p_actor_user_id
    and function_name = p_function_name
    and event_type = 'allowed'
    and created_at >= now() - interval '15 minutes'
  for update;
  if not found then
    raise exception 'Invocation reservation not found or expired' using errcode = '22023';
  end if;

  insert into private.edge_function_security_events (
    restaurant_id,
    actor_user_id,
    function_name,
    event_type,
    action,
    metadata,
    reservation_id
  ) values (
    null,
    p_actor_user_id,
    p_function_name,
    p_event_type,
    trim(action_name),
    safe_metadata || jsonb_build_object('scope', 'user'),
    p_reservation_id
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.record_user_scoped_edge_function_security_event(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_user_scoped_edge_function_security_event(uuid, uuid, text, text, text, jsonb)
  to service_role;

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

create or replace function private.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_create_restaurant_with_owner(
    auth.uid(),
    restaurant_name,
    restaurant_cuisine_type
  );
end;
$$;

revoke all on function private.create_restaurant_with_owner(text, text)
  from public, anon, authenticated, service_role;

create or replace function public.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_create_restaurant_with_owner(
    auth.uid(),
    restaurant_name,
    restaurant_cuisine_type
  );
end;
$$;

revoke all on function public.create_restaurant_with_owner(text, text)
  from public, anon, authenticated, service_role;

comment on function public.create_restaurant_with_owner(text, text) is
  'Legacy auth.uid()-bound restaurant create helper. Authenticated execute is revoked; use service_create_restaurant_with_owner through account-onboarding.';

create or replace function public.service_create_restaurant_with_owner(
  p_actor_user_id uuid,
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language sql
security invoker
set search_path = ''
as $$
  select private.service_create_restaurant_with_owner(
    p_actor_user_id,
    restaurant_name,
    restaurant_cuisine_type
  );
$$;

revoke all on function public.service_create_restaurant_with_owner(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_create_restaurant_with_owner(uuid, text, text)
  to service_role;

comment on function public.service_create_restaurant_with_owner(uuid, text, text) is
  'Service-owned restaurant workspace create with lifetime quota. Authenticated clients must call through account-onboarding.';

create or replace function private.service_claim_restaurant_member_invite(
  p_actor_user_id uuid,
  p_claim_token text
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := p_actor_user_id;
  actor_email text;
  normalized_token text;
  token_hash text;
  target_invite public.restaurant_member_invites;
  target_name text;
  created_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  normalized_token := pg_catalog.lower(pg_catalog.btrim(coalesce(p_claim_token, '')));
  if pg_catalog.length(normalized_token) <> 64 or normalized_token !~ '^[0-9a-f]+$' then
    raise exception 'Invite token is invalid' using errcode = '22023';
  end if;
  token_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(normalized_token, 'UTF8'), 'sha256'),
    'hex'
  );

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email)) into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id;
  if actor_email is null or actor_email = '' then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;

  select invite.* into target_invite
  from public.restaurant_member_invites invite
  where invite.token_hash = token_hash
  for update;
  if not found then
    raise exception 'Invite is unavailable' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_invite.restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select invite.* into target_invite
  from public.restaurant_member_invites invite
  where invite.id = target_invite.id
  for update;

  if target_invite.status = 'expired'
    or (target_invite.status = 'pending' and target_invite.expires_at <= pg_catalog.now())
  then
    update public.restaurant_member_invites invite
    set status = 'expired'
    where invite.id = target_invite.id
      and invite.status = 'pending';
    raise exception 'Invite has expired' using errcode = '22023';
  end if;
  if target_invite.status = 'revoked' then
    raise exception 'Invite has been revoked' using errcode = '42501';
  end if;
  if target_invite.status = 'claimed' then
    raise exception 'Invite has already been claimed' using errcode = '23505';
  end if;
  if target_invite.status <> 'pending' then
    raise exception 'Invite is unavailable' using errcode = 'P0002';
  end if;
  if target_invite.email <> actor_email then
    raise exception 'Invite email does not match the signed-in account' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = target_invite.restaurant_id
      and membership.user_id = actor_user_id
  ) then
    raise exception 'Membership already exists' using errcode = '23505';
  end if;

  target_name := coalesce(
    nullif(pg_catalog.btrim((select profile.name from public.users profile where profile.id = actor_user_id)), ''),
    pg_catalog.split_part(actor_email, '@', 1),
    'Operator'
  );

  insert into public.users (id, restaurant_id, name, email, role)
  values (actor_user_id, target_invite.restaurant_id, target_name, actor_email, target_invite.role)
  on conflict (id) do update
    set
      name = coalesce(nullif(pg_catalog.btrim(public.users.name), ''), excluded.name),
      email = excluded.email
  where public.users.email is distinct from excluded.email
     or coalesce(nullif(pg_catalog.btrim(public.users.name), ''), '') = '';

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (target_invite.restaurant_id, actor_user_id, target_invite.role, 'active')
  returning * into created_membership;

  update public.restaurant_member_invites invite
  set status = 'claimed',
      claimed_by = actor_user_id,
      claimed_at = pg_catalog.now()
  where invite.id = target_invite.id;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    target_invite.restaurant_id,
    actor_user_id,
    'restaurant_member_invite_claimed',
    'restaurant_member_invites',
    target_invite.id,
    jsonb_build_object(
      'membership_id', created_membership.id,
      'role', created_membership.role,
      'email', actor_email,
      'source', 'service_claim_restaurant_member_invite'
    )
  );

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    target_invite.restaurant_id,
    actor_user_id,
    'restaurant_member_added',
    'restaurant_memberships',
    created_membership.id,
    jsonb_build_object(
      'target_user_id', actor_user_id,
      'role', created_membership.role,
      'status', 'active',
      'source', 'invite_claim'
    )
  );

  return created_membership;
end;
$$;

revoke all on function private.service_claim_restaurant_member_invite(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.service_claim_restaurant_member_invite(uuid, text)
  to service_role;

create or replace function public.claim_restaurant_member_invite(
  p_claim_token text
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_claim_restaurant_member_invite(auth.uid(), p_claim_token);
end;
$$;

revoke all on function public.claim_restaurant_member_invite(text)
  from public, anon, authenticated, service_role;

comment on function public.claim_restaurant_member_invite(text) is
  'Legacy auth.uid()-bound invite claim helper. Authenticated execute is revoked; use service_claim_restaurant_member_invite through account-onboarding.';

create or replace function public.service_claim_restaurant_member_invite(
  p_actor_user_id uuid,
  p_claim_token text
)
returns public.restaurant_memberships
language sql
security invoker
set search_path = ''
as $$
  select private.service_claim_restaurant_member_invite(
    p_actor_user_id,
    p_claim_token
  );
$$;

revoke all on function public.service_claim_restaurant_member_invite(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_claim_restaurant_member_invite(uuid, text)
  to service_role;

comment on function public.service_claim_restaurant_member_invite(uuid, text) is
  'Service-owned invite claim for a matching Auth email. Authenticated clients must call through account-onboarding.';
