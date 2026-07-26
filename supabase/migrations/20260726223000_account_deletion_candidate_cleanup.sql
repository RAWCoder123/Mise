-- Correct two-phase account deletion after auth.users cascades membership rows.
-- The deletion plan retains every active owner-restaurant candidate. After the
-- Auth Admin API succeeds, finalization deletes only planned candidates with no
-- remaining active owner. A co-owner added between planning and finalization
-- therefore preserves the restaurant.

create or replace function private.service_plan_account_deletion(
  p_user_id uuid,
  p_requesting_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_id uuid;
  v_owner_restaurant_candidates uuid[] := '{}'::uuid[];
begin
  if p_user_id is null or p_requesting_restaurant_id is null then
    raise exception 'Account deletion plan requires a user and requesting restaurant' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || E'\x1faccount-deletion', 0)
  );

  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_requesting_restaurant_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
  ) then
    raise exception 'Account deletion plan requires an active restaurant membership' using errcode = '42501';
  end if;

  select coalesce(
    pg_catalog.array_agg(owned.restaurant_id order by owned.restaurant_id),
    '{}'::uuid[]
  )
  into v_owner_restaurant_candidates
  from public.restaurant_memberships owned
  where owned.user_id = p_user_id
    and owned.role = 'owner'
    and owned.status = 'active';

  insert into private.account_deletion_audit (
    actor_user_id,
    planned_user_id,
    requesting_restaurant_id,
    planned_deleted_restaurant_ids,
    deleted_restaurant_ids,
    restaurants_deleted,
    memberships_removed,
    metadata
  ) values (
    p_user_id,
    p_user_id,
    p_requesting_restaurant_id,
    v_owner_restaurant_candidates,
    '{}'::uuid[],
    0,
    0,
    pg_catalog.jsonb_build_object(
      'phase', 'deletion_planned',
      'requesting_restaurant_id', p_requesting_restaurant_id,
      'owner_restaurant_candidate_count', pg_catalog.cardinality(v_owner_restaurant_candidates)
    )
  )
  returning id into v_audit_id;

  return pg_catalog.jsonb_build_object(
    'audit_id', v_audit_id,
    'phase', 'deletion_planned',
    'owner_restaurant_candidates', to_jsonb(v_owner_restaurant_candidates)
  );
end;
$$;

create or replace function private.service_finalize_account_deletion(
  p_audit_id uuid,
  p_auth_outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.account_deletion_audit%rowtype;
  v_restaurants_deleted integer := 0;
  v_memberships_removed integer := 0;
  v_deleted_restaurant_ids uuid[] := '{}'::uuid[];
  v_phase text;
begin
  if p_audit_id is null then
    raise exception 'Account deletion audit target is required' using errcode = '22023';
  end if;
  if p_auth_outcome is null
    or p_auth_outcome not in ('auth_deletion_completed', 'auth_deletion_failed')
  then
    raise exception 'Account deletion auth outcome is invalid' using errcode = '22023';
  end if;

  select * into v_row
  from private.account_deletion_audit audit
  where audit.id = p_audit_id
  for update;

  if not found then
    raise exception 'Account deletion audit not found' using errcode = 'P0002';
  end if;

  v_phase := coalesce(v_row.metadata->>'phase', '');

  if v_phase = 'tenant_cleanup_completed' then
    return pg_catalog.jsonb_build_object(
      'audit_id', v_row.id,
      'phase', 'tenant_cleanup_completed',
      'restaurants_deleted', v_row.restaurants_deleted,
      'memberships_removed', v_row.memberships_removed,
      'idempotent', true
    );
  end if;

  if p_auth_outcome = 'auth_deletion_failed' then
    if v_phase not in ('deletion_planned', 'auth_deletion_failed') then
      raise exception 'Account deletion audit cannot record auth failure from phase %', v_phase
        using errcode = '22023';
    end if;

    update private.account_deletion_audit
    set metadata = metadata || pg_catalog.jsonb_build_object(
      'phase', 'auth_deletion_failed',
      'auth_deletion_outcome', 'auth_deletion_failed',
      'auth_finalized_at', pg_catalog.timezone('utc', now())
    )
    where id = p_audit_id;

    return pg_catalog.jsonb_build_object(
      'audit_id', p_audit_id,
      'phase', 'auth_deletion_failed',
      'retryable', true
    );
  end if;

  if exists (
    select 1 from auth.users auth_user
    where auth_user.id = v_row.planned_user_id
  ) then
    raise exception 'Auth user must be deleted before tenant cleanup' using errcode = '55000';
  end if;

  if v_phase not in (
    'deletion_planned',
    'auth_deletion_completed',
    'tenant_cleanup_failed'
  ) then
    raise exception 'Account deletion audit cannot run tenant cleanup from phase %', v_phase
      using errcode = '22023';
  end if;

  update private.account_deletion_audit
  set metadata = metadata || pg_catalog.jsonb_build_object(
    'phase', 'auth_deletion_completed',
    'auth_deletion_outcome', 'auth_deletion_completed',
    'auth_finalized_at', pg_catalog.timezone('utc', now())
  )
  where id = p_audit_id;

  begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_row.planned_user_id::text || E'\x1faccount-deletion', 0)
    );

    select coalesce(
      pg_catalog.array_agg(candidate.restaurant_id order by candidate.restaurant_id),
      '{}'::uuid[]
    )
    into v_deleted_restaurant_ids
    from pg_catalog.unnest(v_row.planned_deleted_restaurant_ids) candidate(restaurant_id)
    where exists (
      select 1 from public.restaurants restaurant
      where restaurant.id = candidate.restaurant_id
    )
      and not exists (
        select 1
        from public.restaurant_memberships remaining_owner
        where remaining_owner.restaurant_id = candidate.restaurant_id
          and remaining_owner.role = 'owner'
          and remaining_owner.status = 'active'
      );

    if pg_catalog.cardinality(v_deleted_restaurant_ids) > 0 then
      delete from public.restaurants restaurant
      where restaurant.id = any(v_deleted_restaurant_ids);
      get diagnostics v_restaurants_deleted = row_count;
    end if;

    delete from public.restaurant_memberships membership
    where membership.user_id = v_row.planned_user_id;
    get diagnostics v_memberships_removed = row_count;

    delete from public.users profile
    where profile.id = v_row.planned_user_id;

    update private.account_deletion_audit
    set
      deleted_restaurant_ids = v_deleted_restaurant_ids,
      restaurants_deleted = v_restaurants_deleted,
      memberships_removed = v_memberships_removed,
      metadata = metadata || pg_catalog.jsonb_build_object(
        'phase', 'tenant_cleanup_completed',
        'restaurants_deleted', v_restaurants_deleted,
        'memberships_removed', v_memberships_removed,
        'tenant_finalized_at', pg_catalog.timezone('utc', now())
      )
    where id = p_audit_id;

    return pg_catalog.jsonb_build_object(
      'audit_id', p_audit_id,
      'phase', 'tenant_cleanup_completed',
      'restaurants_deleted', v_restaurants_deleted,
      'memberships_removed', v_memberships_removed,
      'deleted_restaurant_ids', to_jsonb(v_deleted_restaurant_ids),
      'retryable', false
    );
  exception
    when others then
      update private.account_deletion_audit
      set metadata = metadata || pg_catalog.jsonb_build_object(
        'phase', 'tenant_cleanup_failed',
        'tenant_cleanup_error', pg_catalog.left(sqlerrm, 240),
        'tenant_cleanup_failed_at', pg_catalog.timezone('utc', now())
      )
      where id = p_audit_id;

      return pg_catalog.jsonb_build_object(
        'audit_id', p_audit_id,
        'phase', 'tenant_cleanup_failed',
        'retryable', true,
        'error', pg_catalog.left(sqlerrm, 240)
      );
  end;
end;
$$;

comment on function public.service_plan_account_deletion(uuid, uuid) is
  'Service-only account deletion plan. Captures active owner-restaurant candidates without removing tenant data.';

comment on function public.service_finalize_account_deletion(uuid, text) is
  'Service-only account deletion finalizer. Requires the auth user to be gone and deletes only planned candidates with no remaining active owner.';
