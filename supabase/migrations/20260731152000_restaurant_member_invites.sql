-- Shareable restaurant member invites (claim-token path).
--
-- Owners/admins can create pending invites for emails that may not yet exist in
-- Auth. Invitees sign up or sign in, then claim with a one-time opaque token.
-- Token hashes are service/RPC-only; clients never read the table via Data API.

create table if not exists public.restaurant_member_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null,
  role text not null,
  status text not null default 'pending',
  token_hash text not null,
  created_by uuid not null references auth.users (id),
  claimed_by uuid references auth.users (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  revoked_at timestamptz,
  constraint restaurant_member_invites_email_check
    check (
      char_length(email) between 3 and 254
      and email = lower(btrim(email))
      and email !~ '[[:cntrl:]]'
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint restaurant_member_invites_role_check
    check (role in ('admin', 'manager', 'staff')),
  constraint restaurant_member_invites_status_check
    check (status in ('pending', 'claimed', 'revoked', 'expired')),
  constraint restaurant_member_invites_token_hash_check
    check (char_length(token_hash) = 64 and token_hash ~ '^[0-9a-f]+$')
);

create unique index if not exists restaurant_member_invites_token_hash_uidx
  on public.restaurant_member_invites (token_hash);

create unique index if not exists restaurant_member_invites_pending_email_uidx
  on public.restaurant_member_invites (restaurant_id, email)
  where status = 'pending';

create index if not exists restaurant_member_invites_restaurant_status_idx
  on public.restaurant_member_invites (restaurant_id, status, created_at desc);

alter table public.restaurant_member_invites enable row level security;

revoke all on table public.restaurant_member_invites from public, anon, authenticated;
grant select, insert, update, delete on public.restaurant_member_invites to service_role;

create or replace function public.create_restaurant_member_invite(
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
  actor_user_id uuid := auth.uid();
  actor_role text;
  normalized_email text;
  expires_hours integer;
  next_expires_at timestamptz;
  raw_token text;
  next_token_hash text;
  created_invite public.restaurant_member_invites;
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

  -- gen_random_uuid lives in pg_catalog (PG13+); digest comes from pgcrypto in extensions.
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
    actor_user_id,
    next_expires_at
  )
  returning * into created_invite;

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
    'restaurant_member_invite_created',
    'restaurant_member_invites',
    created_invite.id,
    jsonb_build_object(
      'email', normalized_email,
      'role', p_role,
      'expires_at', created_invite.expires_at
    )
  );

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

create or replace function public.list_restaurant_member_invites(
  p_restaurant_id uuid
)
returns table (
  id uuid,
  restaurant_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  claimed_at timestamptz,
  revoked_at timestamptz
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

  update public.restaurant_member_invites invite
  set status = 'expired'
  where invite.restaurant_id = p_restaurant_id
    and invite.status = 'pending'
    and invite.expires_at <= pg_catalog.now();

  return query
  select
    invite.id,
    invite.restaurant_id,
    invite.email,
    invite.role,
    invite.status,
    invite.expires_at,
    invite.created_at,
    invite.claimed_at,
    invite.revoked_at
  from public.restaurant_member_invites invite
  where invite.restaurant_id = p_restaurant_id
    and invite.status in ('pending', 'claimed', 'revoked', 'expired')
  order by
    case invite.status
      when 'pending' then 0
      when 'claimed' then 1
      when 'revoked' then 2
      else 3
    end,
    invite.created_at desc
  limit 100;
end;
$$;

create or replace function public.revoke_restaurant_member_invite(
  p_restaurant_id uuid,
  p_invite_id uuid
)
returns public.restaurant_member_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  target_invite public.restaurant_member_invites;
begin
  if actor_user_id is null then
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
    and membership.user_id = actor_user_id
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
    'restaurant_member_invite_revoked',
    'restaurant_member_invites',
    target_invite.id,
    jsonb_build_object(
      'email', target_invite.email,
      'role', target_invite.role
    )
  );

  return target_invite;
end;
$$;

create or replace function public.claim_restaurant_member_invite(
  p_claim_token text
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
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
      'email', actor_email
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

revoke all on function public.create_restaurant_member_invite(uuid, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.list_restaurant_member_invites(uuid) from public, anon, authenticated, service_role;
revoke all on function public.revoke_restaurant_member_invite(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_restaurant_member_invite(text) from public, anon, authenticated, service_role;

grant execute on function public.create_restaurant_member_invite(uuid, text, text, integer) to authenticated;
grant execute on function public.list_restaurant_member_invites(uuid) to authenticated;
grant execute on function public.revoke_restaurant_member_invite(uuid, uuid) to authenticated;
grant execute on function public.claim_restaurant_member_invite(text) to authenticated;

comment on table public.restaurant_member_invites is
  'Pending restaurant membership invites with hashed claim tokens; Data API access revoked.';
comment on function public.create_restaurant_member_invite(uuid, text, text, integer) is
  'Creates a pending member invite and returns the one-time claim token to the inviting owner/admin.';
comment on function public.list_restaurant_member_invites(uuid) is
  'Lists recent restaurant member invites without exposing claim token hashes.';
comment on function public.revoke_restaurant_member_invite(uuid, uuid) is
  'Revokes a pending restaurant member invite through owner/admin authority.';
comment on function public.claim_restaurant_member_invite(text) is
  'Claims a pending invite for the authenticated user when their Auth email matches.';
