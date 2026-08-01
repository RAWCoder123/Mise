-- Sole-owner account deletion must close orphan restaurants and remain rollback-safe
-- when Auth hard-delete fails after memberships are revoked.

alter table public.restaurants
  add column if not exists archived_at timestamptz;

comment on column public.restaurants.archived_at is
  'Set when a restaurant is closed by sole-owner account deletion (or equivalent shutdown). Archived restaurants deny membership access.';

create index if not exists restaurants_archived_at_idx
  on public.restaurants (archived_at)
  where archived_at is not null;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in ('requested', 'processing', 'completed', 'cancelled', 'failed'));

create or replace function private.is_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships rm
    join public.restaurants restaurant
      on restaurant.id = rm.restaurant_id
    where auth.uid() is not null
      and rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.status = 'active'
      and restaurant.archived_at is null
  );
$$;

create or replace function private.has_restaurant_role(
  target_restaurant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships rm
    join public.restaurants restaurant
      on restaurant.id = rm.restaurant_id
    where auth.uid() is not null
      and rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.status = 'active'
      and rm.role = any(allowed_roles)
      and restaurant.archived_at is null
  );
$$;

create or replace function private.actor_has_restaurant_role(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_user_id is not null and exists (
    select 1
    from public.restaurant_memberships membership
    join public.restaurants restaurant
      on restaurant.id = membership.restaurant_id
    where membership.user_id = p_actor_user_id
      and membership.restaurant_id = p_restaurant_id
      and membership.status = 'active'
      and membership.role = any(p_allowed_roles)
      and restaurant.archived_at is null
  );
$$;

create or replace function private.guard_last_active_restaurant_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  protected_restaurant_id uuid := old.restaurant_id;
  replacement_is_active_owner boolean := false;
  restaurant_is_archived boolean := false;
begin
  -- Cascades from an explicitly deleted restaurant or Auth user must retain
  -- normal account/workspace deletion semantics.
  if not exists (
    select 1 from public.restaurants restaurant where restaurant.id = protected_restaurant_id
  ) or not exists (
    select 1 from auth.users auth_user where auth_user.id = old.user_id
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select restaurant.archived_at is not null
  into restaurant_is_archived
  from public.restaurants restaurant
  where restaurant.id = protected_restaurant_id;

  -- Sole-owner account deletion archives the restaurant before disabling memberships.
  if coalesce(restaurant_is_archived, false) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- Open account-deletion requests may disable the caller's last ownership.
  if exists (
    select 1
    from public.account_deletion_requests deletion_request
    where deletion_request.subject_user_id = old.user_id
      and deletion_request.status in ('requested', 'processing')
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.role <> 'owner' or old.status <> 'active' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    replacement_is_active_owner := new.restaurant_id = old.restaurant_id
      and new.role = 'owner'
      and new.status = 'active';
  end if;
  if replacement_is_active_owner then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(protected_restaurant_id::text || E'\x1flast-active-owner', 0));
  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = protected_restaurant_id
      and membership.id <> old.id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'A restaurant must retain at least one active owner' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.request_my_account_deletion(
  p_confirmation text default 'DELETE'
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
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
          'source', 'request_my_account_deletion',
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
      jsonb_build_object('source', 'request_my_account_deletion')
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
        'source', 'request_my_account_deletion',
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

comment on function public.request_my_account_deletion(text) is
  'Archives sole-owned restaurants, disables the caller memberships (and orphaned staff on those restaurants), and records an account deletion request. Auth user hard-delete is completed by the request-account-deletion Edge Function.';

revoke all on function public.request_my_account_deletion(text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_my_account_deletion(text)
  to authenticated;

create or replace function public.service_rollback_failed_account_deletion(
  p_request_id uuid
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.account_deletion_requests;
  archived_restaurant_ids uuid[] := array[]::uuid[];
  disabled_membership_ids uuid[] := array[]::uuid[];
begin
  if p_request_id is null then
    raise exception 'Account deletion request id is required' using errcode = '22023';
  end if;

  select * into request_row
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Account deletion request not found' using errcode = 'P0002';
  end if;

  if request_row.status not in ('requested', 'processing') then
    raise exception 'Account deletion request is not rollback-eligible' using errcode = '22023';
  end if;

  archived_restaurant_ids := coalesce(
    (
      select array_agg(value::uuid)
      from jsonb_array_elements_text(coalesce(request_row.metadata -> 'archived_restaurant_ids', '[]'::jsonb)) value
    ),
    array[]::uuid[]
  );
  disabled_membership_ids := coalesce(
    (
      select array_agg(value::uuid)
      from jsonb_array_elements_text(coalesce(request_row.metadata -> 'disabled_membership_ids', '[]'::jsonb)) value
    ),
    array[]::uuid[]
  );

  if coalesce(cardinality(archived_restaurant_ids), 0) > 0 then
    update public.restaurants restaurant
    set archived_at = null
    where restaurant.id = any(archived_restaurant_ids)
      and restaurant.archived_at is not null;
  end if;

  if coalesce(cardinality(disabled_membership_ids), 0) > 0 then
    update public.restaurant_memberships membership
    set status = 'active',
        updated_at = clock_timestamp()
    where membership.id = any(disabled_membership_ids)
      and membership.status = 'disabled';
  end if;

  update public.account_deletion_requests
  set status = 'failed',
      memberships_disabled = 0,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'service_rollback_failed_account_deletion',
        'rolled_back_at', clock_timestamp(),
        'auth_delete_failed', true
      )
  where id = request_row.id
  returning * into request_row;

  return request_row;
end;
$$;

comment on function public.service_rollback_failed_account_deletion(uuid) is
  'Service-only rollback for account deletion when Auth hard-delete fails after memberships/restaurants were revoked.';

revoke all on function public.service_rollback_failed_account_deletion(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_rollback_failed_account_deletion(uuid)
  to service_role;
