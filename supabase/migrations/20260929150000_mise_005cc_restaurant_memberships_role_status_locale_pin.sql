-- MISE-005CC: pin public.restaurant_memberships role/status CHECKs and
-- add_restaurant_member / update_restaurant_member writer gates to COLLATE "C".
--
-- public.restaurant_memberships stores authorization identity under bare IN
-- allowlists from secure_multi_tenant_rls:
--   role in ('owner', 'admin', 'manager', 'staff')
--   status in ('active', 'invited', 'disabled')
-- public.add_restaurant_member mirrors role with bare:
--   p_role not in ('admin', 'manager', 'staff')
-- public.update_restaurant_member mirrors role/status with bare:
--   p_role not in ('owner', 'admin', 'manager', 'staff')
--   p_status not in ('active', 'disabled')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   role:   'owner' | 'admin' | 'manager' | 'staff'
--   status: 'active' | 'invited' | 'disabled'
--   (update writer status gate allows only 'active' | 'disabled';
--    'invited' remains table-legal for the trusted invitation workflow)
--
-- role and status are authorization-critical membership identity. Restaurant
-- authority is exclusively active restaurant_memberships. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; later 005* tips pinned
-- machine-identity and provenance allowlists under COLLATE "C", but left
-- the membership role/status bare-IN CHECKs and writer gates unpinned.
--
-- If LC_CTYPE drifted under a bare-IN membership role/status CHECK, dump/restore
-- could accept authorization-identity bytes the restored C-locale path (and
-- sibling machine-identity gates) would refuse — or the reverse — breaking
-- membership authorization continuity across restore. The same drift on the
-- writer gates could accept bytes the CHECK would refuse (or the reverse).
--
-- Scope:
--   - Replace restaurant_memberships_role_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_memberships_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Rewrite public.add_restaurant_member so the role allowlist gate uses
--     the same COLLATE "C" contract
--   - Rewrite public.update_restaurant_member so role and status allowlist
--     gates use the same COLLATE "C" contract
--   - Preserve revoke from public/anon/authenticated/service_role + grant
--     EXECUTE to authenticated only (matches reinforce_tenant_isolation)
-- Does NOT rewrite remove_restaurant_member, invite/claim stacks (#235),
-- create_restaurant_with_owner, users.preferred_locale (#488), or contested
-- stacks. Alone on main OK. Timestamp after MISE-005CB (#488).

alter table public.restaurant_memberships
  drop constraint if exists restaurant_memberships_role_check;

alter table public.restaurant_memberships
  add constraint restaurant_memberships_role_check
  check (
    role in ('owner', 'admin', 'manager', 'staff')
    and role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_memberships_role_check
  on public.restaurant_memberships is
  'MISE-005CC: exact owner/admin/manager/staff allowlist plus ASCII shape under COLLATE "C". Authorization-critical membership identity.';

alter table public.restaurant_memberships
  drop constraint if exists restaurant_memberships_status_check;

alter table public.restaurant_memberships
  add constraint restaurant_memberships_status_check
  check (
    status in ('active', 'invited', 'disabled')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_memberships_status_check
  on public.restaurant_memberships is
  'MISE-005CC: exact active/invited/disabled allowlist plus ASCII shape under COLLATE "C". Authorization-critical membership identity.';

comment on column public.restaurant_memberships.role is
  'Membership authorization role. Allowed values: owner, admin, manager, staff under COLLATE "C".';

comment on column public.restaurant_memberships.status is
  'Membership authorization status. Allowed values: active, invited, disabled under COLLATE "C".';

create or replace function public.add_restaurant_member(
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
  actor_user_id uuid := auth.uid();
  actor_role text;
  created_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_target_user_id is null or p_target_user_id = actor_user_id then
    raise exception 'Membership target is not allowed' using errcode = '42501';
  end if;
  if p_role is null
    or p_role not in ('admin', 'manager', 'staff')
    or p_role collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
  then
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

  if not exists (select 1 from auth.users auth_user where auth_user.id = p_target_user_id) then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (p_restaurant_id, p_target_user_id, p_role, 'active')
  returning * into created_membership;
  return created_membership;
end;
$$;

comment on function public.add_restaurant_member(uuid, uuid, text) is
  'MISE-005CC: add membership under exact admin/manager/staff allowlist plus COLLATE "C" ASCII shape; owner/admin authority only.';

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
  if p_role is not null
    and (
      p_role not in ('owner', 'admin', 'manager', 'staff')
      or p_role collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
    )
  then
    raise exception 'Membership role is invalid' using errcode = '22023';
  end if;
  if p_status is not null
    and (
      p_status not in ('active', 'disabled')
      or p_status collate "C" !~ '^[A-Za-z0-9._-]{1,80}$'
    )
  then
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
  return updated_membership;
end;
$$;

comment on function public.update_restaurant_member(uuid, uuid, text, text) is
  'MISE-005CC: update membership under exact role/status allowlists plus COLLATE "C" ASCII shape; owner/admin authority only.';

-- Keep membership mutation RPC-only. Existing authenticated EXECUTE remains
-- the only client write path; no direct table DML capability is added.
revoke all on function public.add_restaurant_member(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_member(uuid, uuid, text, text) from public, anon, authenticated, service_role;

grant execute on function public.add_restaurant_member(uuid, uuid, text) to authenticated;
grant execute on function public.update_restaurant_member(uuid, uuid, text, text) to authenticated;
