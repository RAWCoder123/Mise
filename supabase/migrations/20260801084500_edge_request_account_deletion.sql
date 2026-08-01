-- Route account deletion request creation through a service-owned RPC so
-- authenticated clients must use the request-account-deletion Edge Function.
-- Direct RPC calls previously could disable memberships / archive sole-owned
-- restaurants without completing Auth deletion.

create or replace function private.service_request_my_account_deletion(
  p_actor_user_id uuid,
  p_confirmation text default 'DELETE'
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := p_actor_user_id;
  disabled_count integer := 0;
  archived_count integer := 0;
  request_row public.account_deletion_requests;
  sole_owned_restaurant_ids uuid[] := array[]::uuid[];
  disabled_membership_ids uuid[] := array[]::uuid[];
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if upper(trim(coalesce(p_confirmation, ''))) <> 'DELETE' then
    raise exception 'Account deletion confirmation is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || E'\x1faccount-deletion', 0)
  );

  select * into request_row
  from public.account_deletion_requests
  where subject_user_id = actor_user_id
    and status in ('requested', 'processing')
  order by requested_at desc
  limit 1
  for update;

  if found then
    update public.account_deletion_requests
    set user_id = actor_user_id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'source', 'service_request_my_account_deletion',
          'rerequested_at', clock_timestamp()
        )
    where id = request_row.id
    returning * into request_row;
  else
    insert into public.account_deletion_requests (
      user_id,
      subject_user_id,
      status,
      memberships_disabled,
      metadata
    ) values (
      actor_user_id,
      actor_user_id,
      'requested',
      0,
      jsonb_build_object('source', 'service_request_my_account_deletion')
    )
    returning * into request_row;
  end if;

  select coalesce(array_agg(owner_membership.restaurant_id order by owner_membership.restaurant_id), array[]::uuid[])
  into sole_owned_restaurant_ids
  from public.restaurant_memberships owner_membership
  where owner_membership.user_id = actor_user_id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active'
    and not exists (
      select 1
      from public.restaurant_memberships other_owner
      where other_owner.restaurant_id = owner_membership.restaurant_id
        and other_owner.id <> owner_membership.id
        and other_owner.role = 'owner'
        and other_owner.status = 'active'
    );

  if coalesce(cardinality(sole_owned_restaurant_ids), 0) > 0 then
    update public.restaurants restaurant
    set archived_at = coalesce(restaurant.archived_at, clock_timestamp())
    where restaurant.id = any(sole_owned_restaurant_ids)
      and restaurant.archived_at is null;
    get diagnostics archived_count = row_count;
  end if;

  select coalesce(array_agg(membership.id order by membership.id), array[]::uuid[])
  into disabled_membership_ids
  from public.restaurant_memberships membership
  where membership.status = 'active'
    and (
      membership.user_id = actor_user_id
      or membership.restaurant_id = any(sole_owned_restaurant_ids)
    );

  if coalesce(cardinality(disabled_membership_ids), 0) > 0 then
    update public.restaurant_memberships membership
    set status = 'disabled',
        updated_at = clock_timestamp()
    where membership.id = any(disabled_membership_ids)
      and membership.status = 'active';
    get diagnostics disabled_count = row_count;
  end if;

  update public.account_deletion_requests
  set memberships_disabled = greatest(memberships_disabled, disabled_count),
      user_id = actor_user_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'service_request_my_account_deletion',
        'archived_restaurant_ids', to_jsonb(sole_owned_restaurant_ids),
        'archived_restaurant_count', archived_count,
        'disabled_membership_ids', to_jsonb(disabled_membership_ids),
        'disabled_membership_count', disabled_count
      )
  where id = request_row.id
  returning * into request_row;

  return request_row;
end;
$$;

revoke all on function private.service_request_my_account_deletion(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function private.service_request_my_account_deletion(uuid, text)
  to service_role;

create or replace function public.request_my_account_deletion(
  p_confirmation text default 'DELETE'
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_request_my_account_deletion(auth.uid(), p_confirmation);
end;
$$;

revoke all on function public.request_my_account_deletion(text)
  from public, anon, authenticated, service_role;

comment on function public.request_my_account_deletion(text) is
  'Legacy auth.uid()-bound account deletion request helper. Authenticated execute is revoked; use service_request_my_account_deletion through request-account-deletion.';

create or replace function public.service_request_my_account_deletion(
  p_actor_user_id uuid,
  p_confirmation text default 'DELETE'
)
returns public.account_deletion_requests
language sql
security invoker
set search_path = ''
as $$
  select private.service_request_my_account_deletion(
    p_actor_user_id,
    p_confirmation
  );
$$;

revoke all on function public.service_request_my_account_deletion(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_request_my_account_deletion(uuid, text)
  to service_role;

comment on function public.service_request_my_account_deletion(uuid, text) is
  'Service-owned account deletion request. Archives sole-owned restaurants, disables memberships, and records the request. Auth hard-delete remains in request-account-deletion.';
