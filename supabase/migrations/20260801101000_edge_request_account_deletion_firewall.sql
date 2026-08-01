-- Bring request-account-deletion under the same user-scoped Edge firewall as
-- account-onboarding: per-user rate limiting, reservation audit, and finalized
-- security events. Roles remain unused for user-scoped functions.

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
      'account-onboarding',
      'request-account-deletion'
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
      ('account-onboarding', 12, 60, array[]::text[]),
      -- Destructive path: tighter window than onboarding create/claim.
      ('request-account-deletion', 4, 300, array[]::text[])
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
  if p_function_name not in ('account-onboarding', 'request-account-deletion') then
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
  if p_function_name not in ('account-onboarding', 'request-account-deletion') then
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

comment on function public.reserve_user_scoped_edge_function_invocation(uuid, text, text, jsonb) is
  'Service-owned per-user Edge reservation for account-onboarding and request-account-deletion.';
comment on function public.record_user_scoped_edge_function_security_event(uuid, uuid, text, text, text, jsonb) is
  'Service-owned terminal security-event writer for user-scoped Edge functions.';
