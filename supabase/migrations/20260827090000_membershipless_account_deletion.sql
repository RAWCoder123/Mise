-- Allow signed-in users with zero active restaurant memberships to delete their
-- Auth account. Restaurant-scoped delete-account remains the path when any
-- active membership exists. Membershipless planning never deletes restaurants.

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
  v_active_membership_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'Account deletion plan requires a user' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || E'\x1faccount-deletion', 0)
  );

  select count(*)::integer
  into v_active_membership_count
  from public.restaurant_memberships membership
  where membership.user_id = p_user_id
    and membership.status = 'active';

  if p_requesting_restaurant_id is null then
    if v_active_membership_count > 0 then
      raise exception 'Account deletion without a restaurant requires zero active memberships'
        using errcode = '42501';
    end if;

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
      null,
      '{}'::uuid[],
      '{}'::uuid[],
      0,
      0,
      pg_catalog.jsonb_build_object(
        'phase', 'deletion_planned',
        'requesting_restaurant_id', null,
        'membershipless', true,
        'owner_restaurant_candidate_count', 0
      )
    )
    returning id into v_audit_id;

    return pg_catalog.jsonb_build_object(
      'audit_id', v_audit_id,
      'phase', 'deletion_planned',
      'owner_restaurant_candidates', '[]'::jsonb,
      'membershipless', true
    );
  end if;

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
      'membershipless', false,
      'owner_restaurant_candidate_count', pg_catalog.cardinality(v_owner_restaurant_candidates)
    )
  )
  returning id into v_audit_id;

  return pg_catalog.jsonb_build_object(
    'audit_id', v_audit_id,
    'phase', 'deletion_planned',
    'owner_restaurant_candidates', to_jsonb(v_owner_restaurant_candidates),
    'membershipless', false
  );
end;
$$;

create or replace function public.service_plan_account_deletion(
  p_user_id uuid,
  p_requesting_restaurant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_plan_account_deletion(p_user_id, p_requesting_restaurant_id);
$$;

revoke all on function private.service_plan_account_deletion(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_plan_account_deletion(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function private.service_plan_account_deletion(uuid, uuid) to service_role;
grant execute on function public.service_plan_account_deletion(uuid, uuid) to service_role;

comment on function public.service_plan_account_deletion(uuid, uuid) is
  'Service-only account deletion planner. Null requesting restaurant is allowed only when the user has zero active memberships; that path never plans restaurant deletes.';

-- User-scoped firewall for membershipless delete-account. restaurant_id stays null.
create or replace function public.service_reserve_membershipless_account_deletion(
  p_actor_user_id uuid,
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

  select * into current_policy from private.edge_function_policy('delete-account');
  if not found then
    raise exception 'Unsupported function' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.restaurant_memberships membership
    where membership.user_id = p_actor_user_id
      and membership.status = 'active'
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_actor_user_id::text || E'\x1fdelete-account\x1fmembershipless',
    0
  ));

  select count(*)::integer into attempt_count
  from private.edge_function_security_events events
  where events.restaurant_id is null
    and events.actor_user_id = p_actor_user_id
    and events.function_name = 'delete-account'
    and events.created_at >= now() - make_interval(secs => current_policy.window_seconds)
    and events.event_type in ('allowed', 'rate_limited');

  if attempt_count >= current_policy.max_attempts then
    insert into private.edge_function_security_events (
      restaurant_id, actor_user_id, function_name, event_type, action, metadata
    ) values (
      null,
      p_actor_user_id,
      'delete-account',
      'rate_limited',
      trim(action_name),
      safe_metadata || jsonb_build_object(
        'window_seconds', current_policy.window_seconds,
        'max_attempts', current_policy.max_attempts,
        'membershipless', true
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
    'delete-account',
    'allowed',
    trim(action_name),
    safe_metadata || jsonb_build_object('membershipless', true)
  ) returning id into reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', reservation_id,
    'remaining', greatest(current_policy.max_attempts - attempt_count - 1, 0),
    'window_seconds', current_policy.window_seconds
  );
end;
$$;

create or replace function public.service_record_membershipless_account_deletion_event(
  p_actor_user_id uuid,
  p_reservation_id uuid,
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
  if p_actor_user_id is null or p_reservation_id is null then
    raise exception 'Missing invocation authority' using errcode = '22023';
  end if;

  select * into reservation_row
  from private.edge_function_security_events
  where id = p_reservation_id
    and restaurant_id is null
    and actor_user_id = p_actor_user_id
    and function_name = 'delete-account'
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
    'delete-account',
    p_event_type,
    trim(action_name),
    safe_metadata || jsonb_build_object('membershipless', true),
    p_reservation_id
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.service_reserve_membershipless_account_deletion(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.service_record_membershipless_account_deletion_event(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.service_reserve_membershipless_account_deletion(uuid, text, jsonb)
  to service_role;
grant execute on function public.service_record_membershipless_account_deletion_event(uuid, uuid, text, text, jsonb)
  to service_role;

comment on function public.service_reserve_membershipless_account_deletion(uuid, text, jsonb) is
  'Service-only delete-account firewall for users with zero active restaurant memberships.';
comment on function public.service_record_membershipless_account_deletion_event(uuid, uuid, text, text, jsonb) is
  'Service-only terminal security event writer for membershipless delete-account reservations.';
