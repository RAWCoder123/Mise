-- Account deletion support (Apple App Store requirement).
--
-- The delete-account Edge Function verifies the caller's JWT and then uses
-- this service-only RPC to remove tenant data atomically before deleting the
-- auth user through the admin API:
--   1. restaurants where the caller is the only owner are deleted (all tenant
--      rows cascade through existing restaurant_id foreign keys);
--   2. the caller's remaining memberships are removed so shared restaurants
--      survive with their other members intact;
--   3. the legacy public.users profile row is removed (auth.users deletion
--      would cascade it anyway, but this keeps the RPC self-contained).

create or replace function private.service_delete_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  restaurants_deleted integer := 0;
  memberships_removed integer := 0;
begin
  if p_user_id is null then
    raise exception 'Account target is required' using errcode = '22023';
  end if;

  -- Serialize with membership mutations so the sole-owner check cannot race
  -- an ownership transfer happening in another transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || E'\x1faccount-deletion', 0)
  );

  with sole_owner_restaurants as (
    select owned.restaurant_id
    from public.restaurant_memberships owned
    where owned.user_id = p_user_id
      and owned.role = 'owner'
      and not exists (
        select 1
        from public.restaurant_memberships other
        where other.restaurant_id = owned.restaurant_id
          and other.user_id <> p_user_id
          and other.role = 'owner'
          and other.status = 'active'
      )
  ),
  deleted_restaurants as (
    delete from public.restaurants restaurant
    using sole_owner_restaurants sole
    where restaurant.id = sole.restaurant_id
    returning restaurant.id
  )
  select count(*) into restaurants_deleted from deleted_restaurants;

  delete from public.restaurant_memberships membership
  where membership.user_id = p_user_id;
  get diagnostics memberships_removed = row_count;

  delete from public.users profile
  where profile.id = p_user_id;

  return pg_catalog.jsonb_build_object(
    'restaurants_deleted', restaurants_deleted,
    'memberships_removed', memberships_removed
  );
end;
$$;

create or replace function public.service_delete_account(p_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_delete_account(p_user_id);
$$;

revoke all on function private.service_delete_account(uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_delete_account(uuid) from public, anon, authenticated, service_role;
grant execute on function private.service_delete_account(uuid) to service_role;
grant execute on function public.service_delete_account(uuid) to service_role;

comment on function public.service_delete_account(uuid) is
  'Service-only account cleanup: deletes sole-owner restaurants (cascade), removes memberships, and clears the legacy profile. The Edge Function deletes the auth user afterwards.';

-- Register delete-account with the private Edge firewall so rate limits and
-- audit events follow the same lifecycle as restaurant-scoped functions.
alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
      'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',
      'delete-account'
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
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager']::text[]),
      ('delete-account', 3, 300, array['owner', 'admin', 'manager', 'staff']::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated, service_role;
