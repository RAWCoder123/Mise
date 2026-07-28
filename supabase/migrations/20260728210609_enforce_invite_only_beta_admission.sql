-- August 3 beta admission is admin-provisioned only.
--
-- Authenticated restaurant operators may sign in to an existing membership,
-- but they cannot allocate a tenant. Mise administration provisions an
-- existing Supabase Auth identity through the service-only RPC below. The
-- request is replay-safe and every new restaurant inherits default-off
-- operational/provider controls from the existing restaurant trigger.

create table private.beta_restaurant_provisioning_requests (
  idempotency_key uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  normalized_restaurant_name text not null,
  normalized_cuisine_type text,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.beta_restaurant_provisioning_requests enable row level security;

revoke all on table private.beta_restaurant_provisioning_requests
from public, anon, authenticated, service_role;

create index beta_restaurant_provisioning_owner_created_idx
on private.beta_restaurant_provisioning_requests (owner_user_id, created_at desc);

-- Remove the former self-service tenant-allocation boundary. Keeping the
-- legacy functions but revoking them avoids breaking old migration history
-- while making every Data API call fail closed.
revoke all on function public.create_restaurant_with_owner(text, text)
from public, anon, authenticated, service_role;
revoke all on function private.create_restaurant_with_owner(text, text)
from public, anon, authenticated, service_role;

create or replace function private.service_provision_beta_restaurant(
  p_owner_user_id uuid,
  p_restaurant_name text,
  p_restaurant_cuisine_type text,
  p_idempotency_key uuid
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text := pg_catalog.btrim(p_restaurant_name);
  normalized_cuisine text := nullif(pg_catalog.btrim(p_restaurant_cuisine_type), '');
  existing_request private.beta_restaurant_provisioning_requests%rowtype;
  provisioned_restaurant public.restaurants%rowtype;
  lifetime_workspace_count integer;
  controls public.restaurant_operational_controls%rowtype;
begin
  if p_owner_user_id is null or p_idempotency_key is null then
    raise exception 'Owner user and idempotency key are required' using errcode = '22023';
  end if;
  if pg_catalog.length(normalized_name) not between 1 and 120 then
    raise exception 'Restaurant name must be between 1 and 120 characters' using errcode = '22023';
  end if;
  if normalized_cuisine is not null and pg_catalog.length(normalized_cuisine) > 120 then
    raise exception 'Cuisine type must be at most 120 characters' using errcode = '22023';
  end if;
  if not exists (
    select 1 from auth.users auth_user where auth_user.id = p_owner_user_id
  ) then
    raise exception 'Owner Auth user does not exist' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key::text || E'\x1fbeta-provision', 0)
  );

  select request.*
  into existing_request
  from private.beta_restaurant_provisioning_requests request
  where request.idempotency_key = p_idempotency_key;

  if found then
    if existing_request.owner_user_id <> p_owner_user_id
      or existing_request.normalized_restaurant_name <> normalized_name
      or existing_request.normalized_cuisine_type is distinct from normalized_cuisine
    then
      raise exception 'Provisioning idempotency key conflicts with the accepted request'
        using errcode = '23505';
    end if;

    select restaurant.*
    into strict provisioned_restaurant
    from public.restaurants restaurant
    where restaurant.id = existing_request.restaurant_id;
    return provisioned_restaurant;
  end if;

  -- Serialize an owner's allocations so repeated administration requests
  -- cannot race the lifetime quota or create duplicate same-name tenants.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_user_id::text || E'\x1fowner-workspace-quota', 0)
  );

  select restaurant.*
  into provisioned_restaurant
  from public.restaurants restaurant
  join public.restaurant_memberships membership
    on membership.restaurant_id = restaurant.id
  where membership.user_id = p_owner_user_id
    and membership.role = 'owner'
    and membership.status = 'active'
    and pg_catalog.lower(pg_catalog.btrim(restaurant.name)) =
      pg_catalog.lower(normalized_name)
  order by membership.created_at, membership.id
  limit 1;

  if found then
    if provisioned_restaurant.cuisine_type is distinct from normalized_cuisine then
      raise exception 'An active owner restaurant already uses this name with different provisioning data'
        using errcode = '23505';
    end if;
    insert into private.beta_restaurant_provisioning_requests (
      idempotency_key,
      owner_user_id,
      normalized_restaurant_name,
      normalized_cuisine_type,
      restaurant_id
    )
    values (
      p_idempotency_key,
      p_owner_user_id,
      normalized_name,
      normalized_cuisine,
      provisioned_restaurant.id
    );
    return provisioned_restaurant;
  end if;

  select pg_catalog.count(*)::integer
  into lifetime_workspace_count
  from private.restaurant_workspace_allocations allocation
  where allocation.creator_user_id = p_owner_user_id;

  if lifetime_workspace_count >= 5 then
    raise exception 'A user may be provisioned at most five restaurant workspaces'
      using errcode = '54000';
  end if;

  insert into public.restaurants (name, cuisine_type)
  values (normalized_name, normalized_cuisine)
  returning * into provisioned_restaurant;

  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (provisioned_restaurant.id, p_owner_user_id, 'owner', 'active');

  insert into private.restaurant_workspace_allocations (restaurant_id, creator_user_id)
  values (provisioned_restaurant.id, p_owner_user_id);

  insert into private.beta_restaurant_provisioning_requests (
    idempotency_key,
    owner_user_id,
    normalized_restaurant_name,
    normalized_cuisine_type,
    restaurant_id
  )
  values (
    p_idempotency_key,
    p_owner_user_id,
    normalized_name,
    normalized_cuisine,
    provisioned_restaurant.id
  );

  select restaurant_controls.*
  into strict controls
  from public.restaurant_operational_controls restaurant_controls
  where restaurant_controls.restaurant_id = provisioned_restaurant.id;

  if controls.square_sync_enabled
    or controls.square_webhooks_enabled
    or controls.gmail_delivery_enabled
    or controls.insight_generation_enabled
    or controls.order_drafting_enabled
    or controls.stripe_invoicing_enabled
    or controls.ordering_policy <> 'off'
  then
    raise exception 'Provisioned restaurant controls are not safely disabled'
      using errcode = '55000';
  end if;

  return provisioned_restaurant;
end;
$$;

revoke all on function private.service_provision_beta_restaurant(uuid, text, text, uuid)
from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.service_provision_beta_restaurant(uuid, text, text, uuid)
to service_role;

create or replace function public.service_provision_beta_restaurant(
  p_owner_user_id uuid,
  p_restaurant_name text,
  p_restaurant_cuisine_type text,
  p_idempotency_key uuid
)
returns public.restaurants
language sql
security invoker
set search_path = ''
as $$
  select private.service_provision_beta_restaurant(
    p_owner_user_id,
    p_restaurant_name,
    p_restaurant_cuisine_type,
    p_idempotency_key
  );
$$;

revoke all on function public.service_provision_beta_restaurant(uuid, text, text, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.service_provision_beta_restaurant(uuid, text, text, uuid)
to service_role;

comment on function public.service_provision_beta_restaurant(uuid, text, text, uuid) is
  'Service-admin-only, replay-safe restaurant provisioning for the invite-only beta. The Auth user must already exist.';
