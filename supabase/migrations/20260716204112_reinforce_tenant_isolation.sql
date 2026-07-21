-- Enforce the canonical authorization invariant:
-- authenticated user -> active membership -> permitted role -> tenant row.
-- Membership and profile authority are RPC-only; the Data API grants below
-- are an explicit allowlist for the private-beta surface.

-- Supabase projects can inherit broad default privileges for exposed schemas.
-- Remove those defaults and require each future migration to opt in explicitly.
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;

revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;

-- Authenticated users can read only rows admitted by RLS. Operational writes
-- remain available only where the product intentionally uses direct Data API
-- mutations; atomic guidance/order/audit tables stay read-only and RPC-owned.
grant select on table
  public.restaurants,
  public.users,
  public.restaurant_memberships,
  public.pos_sales,
  public.inventory_items,
  public.menu_item_ingredients,
  public.purchase_recommendations,
  public.supplier_orders,
  public.insights,
  public.pos_integrations,
  public.sales_imports,
  public.supplier_items,
  public.purchase_orders,
  public.ai_insights,
  public.audit_logs,
  public.restaurant_email_connections,
  public.supplier_recipients,
  public.setup_attachments
to authenticated;

grant insert, update, delete on table
  public.pos_integrations,
  public.sales_imports,
  public.supplier_items,
  public.purchase_orders,
  public.restaurant_email_connections
to authenticated;

grant delete on table public.supplier_recipients to authenticated;

-- The service role is restricted to trusted Edge/bootstrap code and never
-- enters Expo. It receives explicit CRUD rather than inherited TRUNCATE,
-- TRIGGER, or REFERENCES privileges.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Direct membership writes cannot express the role hierarchy safely. All
-- authenticated mutations are handled by the guarded functions below.
drop policy if exists "Owners and admins can invite restaurant members" on public.restaurant_memberships;
drop policy if exists "Owners and admins can update restaurant members" on public.restaurant_memberships;
drop policy if exists "Owners and admins can delete restaurant members" on public.restaurant_memberships;

-- Mutable legacy profile fields are not authorization inputs. Even display
-- names are updated through a bounded RPC so clients never receive UPDATE on
-- public.users or its legacy role/restaurant columns.
drop policy if exists "Users can update own profile" on public.users;

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

  if not exists (select 1 from auth.users auth_user where auth_user.id = p_target_user_id) then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (p_restaurant_id, p_target_user_id, p_role, 'active')
  returning * into created_membership;
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
  return removed_membership;
end;
$$;

create or replace function public.update_my_profile(p_name text)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_email text;
  normalized_name text := pg_catalog.btrim(p_name);
  updated_user public.users;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_name is null or pg_catalog.length(normalized_name) not between 1 and 120 then
    raise exception 'Profile name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  select auth_user.email into actor_email
  from auth.users auth_user
  where auth_user.id = actor_user_id;
  if actor_email is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  insert into public.users (id, restaurant_id, name, email, role)
  values (actor_user_id, null, normalized_name, actor_email, 'staff')
  on conflict (id) do update
    set name = excluded.name
  returning * into updated_user;
  return updated_user;
end;
$$;

-- Keep the two legacy private implementations behind their public wrappers.
-- The wrappers now run as definers and perform an explicit authentication
-- check, so authenticated callers no longer need private workflow execution.
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
  return private.create_restaurant_with_owner(restaurant_name, restaurant_cuisine_type);
end;
$$;

create or replace function public.update_restaurant_profile(
  p_restaurant_id uuid,
  p_patch jsonb
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
  return private.update_restaurant_profile(p_restaurant_id, p_patch);
end;
$$;

revoke execute on function private.create_restaurant_with_owner(text, text) from public, anon, authenticated, service_role;
revoke execute on function private.update_restaurant_profile(uuid, jsonb) from public, anon, authenticated, service_role;

revoke all on function public.add_restaurant_member(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_member(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.remove_restaurant_member(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.update_my_profile(text) from public, anon, authenticated, service_role;
revoke all on function public.create_restaurant_with_owner(text, text) from public, anon, authenticated, service_role;
revoke all on function public.update_restaurant_profile(uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.add_restaurant_member(uuid, uuid, text) to authenticated;
grant execute on function public.update_restaurant_member(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_restaurant_member(uuid, uuid) to authenticated;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.create_restaurant_with_owner(text, text) to authenticated;
grant execute on function public.update_restaurant_profile(uuid, jsonb) to authenticated;

-- Edge audit writes are service-only and recheck live membership in the same
-- transaction. This removes the last direct service-role audit insertion path.
create or replace function private.service_record_edge_audit_log(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_entity_table text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.audit_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_log public.audit_logs;
begin
  if p_actor_user_id is null or p_restaurant_id is null
    or not private.actor_has_restaurant_role(
      p_actor_user_id,
      p_restaurant_id,
      array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Restaurant audit access denied' using errcode = '42501';
  end if;
  if p_action is null or pg_catalog.length(p_action) not between 1 and 120
    or p_entity_table is null or pg_catalog.length(p_entity_table) not between 1 and 120
    or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 8192
  then
    raise exception 'Audit event is invalid' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, p_action, p_entity_table, p_entity_id, p_metadata
  )
  returning * into created_log;
  return created_log;
end;
$$;

create or replace function public.service_record_edge_audit_log(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_entity_table text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.audit_logs
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_edge_audit_log(
    p_actor_user_id,
    p_restaurant_id,
    p_action,
    p_entity_table,
    p_entity_id,
    p_metadata
  );
$$;

revoke all on function private.service_record_edge_audit_log(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_record_edge_audit_log(uuid, uuid, text, text, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.service_record_edge_audit_log(uuid, uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.service_record_edge_audit_log(uuid, uuid, text, text, uuid, jsonb) to service_role;

-- A reservation terminal event must reference a reservation in the same
-- tenant, even if future trusted code accidentally supplies a mismatched UUID.
alter table private.edge_function_security_events
  add constraint edge_function_security_events_restaurant_id_id_key
  unique (restaurant_id, id);

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_reservation_id_fkey;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_reservation_tenant_fkey
  foreign key (restaurant_id, reservation_id)
  references private.edge_function_security_events(restaurant_id, id)
  on delete cascade;

-- Trigger helpers and new functions must not be callable merely because they
-- were created in an exposed schema.
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;

comment on table public.restaurant_memberships is
  'Canonical restaurant authorization source. Authenticated mutations are RPC-only and self-mutation is forbidden.';
comment on column public.users.role is
  'Legacy profile metadata only. It is immutable through the Data API and is never an authorization source.';
