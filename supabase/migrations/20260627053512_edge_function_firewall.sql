create schema if not exists private;

create table if not exists private.edge_function_security_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null default auth.uid(),
  function_name text not null check (
    function_name in (
      'sync-pos-sales',
      'generate-ai-insights',
      'link-gmail',
      'send-supplier-email'
    )
  ),
  event_type text not null check (
    event_type in (
      'allowed',
      'denied',
      'rate_limited',
      'blocked',
      'completed',
      'error'
    )
  ),
  action text not null check (length(trim(action)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint edge_function_security_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table private.edge_function_security_events is
  'Private audit trail and rate-limit ledger for Supabase Edge Function attempts. Not exposed through the Data API.';

create index if not exists idx_edge_function_security_events_restaurant_function_time
  on private.edge_function_security_events(restaurant_id, function_name, created_at desc);

create index if not exists idx_edge_function_security_events_actor_function_time
  on private.edge_function_security_events(actor_user_id, function_name, created_at desc);

alter table private.edge_function_security_events enable row level security;
revoke all on table private.edge_function_security_events from public, anon, authenticated;

create or replace function private.edge_function_policy(p_function_name text)
returns table (
  max_attempts integer,
  window_seconds integer,
  allowed_roles text[]
)
language sql
stable
security definer
set search_path = private, public
as $$
  select policy.max_attempts, policy.window_seconds, policy.allowed_roles
  from (
    values
      ('sync-pos-sales', 8, 60, array['owner', 'admin', 'manager']::text[]),
      ('generate-ai-insights', 6, 300, array['owner', 'admin', 'manager']::text[]),
      ('link-gmail', 4, 300, array['owner', 'admin']::text[]),
      ('send-supplier-email', 12, 60, array['owner', 'admin', 'manager']::text[])
  ) as policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated;

create or replace function public.reserve_edge_function_invocation(
  target_restaurant_id uuid,
  p_function_name text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  current_policy record;
  attempt_count integer;
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if target_restaurant_id is null then
    raise exception 'Missing restaurant id' using errcode = '22023';
  end if;

  if jsonb_typeof(safe_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;

  select *
  into current_policy
  from private.edge_function_policy(p_function_name);

  if not found then
    raise exception 'Unsupported function' using errcode = '22023';
  end if;

  if not private.has_restaurant_role(target_restaurant_id, current_policy.allowed_roles) then
    insert into private.edge_function_security_events (
      restaurant_id,
      actor_user_id,
      function_name,
      event_type,
      action,
      metadata
    )
    values (
      target_restaurant_id,
      current_user_id,
      p_function_name,
      'denied',
      action_name,
      safe_metadata || jsonb_build_object('reason', 'forbidden')
    );

    return jsonb_build_object('allowed', false, 'reason', 'forbidden');
  end if;

  select count(*)::integer
  into attempt_count
  from private.edge_function_security_events events
  where events.restaurant_id = target_restaurant_id
    and events.actor_user_id = current_user_id
    and events.function_name = p_function_name
    and events.created_at >= now() - make_interval(secs => current_policy.window_seconds)
    and events.event_type in ('allowed', 'rate_limited');

  if attempt_count >= current_policy.max_attempts then
    insert into private.edge_function_security_events (
      restaurant_id,
      actor_user_id,
      function_name,
      event_type,
      action,
      metadata
    )
    values (
      target_restaurant_id,
      current_user_id,
      p_function_name,
      'rate_limited',
      action_name,
      safe_metadata || jsonb_build_object(
        'window_seconds',
        current_policy.window_seconds,
        'max_attempts',
        current_policy.max_attempts
      )
    );

    return jsonb_build_object(
      'allowed',
      false,
      'reason',
      'rate_limited',
      'retry_after_seconds',
      current_policy.window_seconds
    );
  end if;

  insert into private.edge_function_security_events (
    restaurant_id,
    actor_user_id,
    function_name,
    event_type,
    action,
    metadata
  )
  values (
    target_restaurant_id,
    current_user_id,
    p_function_name,
    'allowed',
    action_name,
    safe_metadata
  );

  return jsonb_build_object(
    'allowed',
    true,
    'remaining',
    greatest(current_policy.max_attempts - attempt_count - 1, 0),
    'window_seconds',
    current_policy.window_seconds
  );
end;
$$;

create or replace function public.record_edge_function_security_event(
  target_restaurant_id uuid,
  p_function_name text,
  p_event_type text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if target_restaurant_id is null then
    raise exception 'Missing restaurant id' using errcode = '22023';
  end if;

  if p_event_type not in ('blocked', 'completed', 'error') then
    raise exception 'Unsupported security event type' using errcode = '22023';
  end if;

  if jsonb_typeof(safe_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;

  perform 1 from private.edge_function_policy(p_function_name);
  if not found then
    raise exception 'Unsupported function' using errcode = '22023';
  end if;

  if not private.is_restaurant_member(target_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.edge_function_security_events (
    restaurant_id,
    actor_user_id,
    function_name,
    event_type,
    action,
    metadata
  )
  values (
    target_restaurant_id,
    current_user_id,
    p_function_name,
    p_event_type,
    action_name,
    safe_metadata
  );

  return true;
end;
$$;

revoke all on function public.reserve_edge_function_invocation(uuid, text, text, jsonb) from public, anon;
revoke all on function public.record_edge_function_security_event(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.reserve_edge_function_invocation(uuid, text, text, jsonb) to authenticated;
grant execute on function public.record_edge_function_security_event(uuid, text, text, text, jsonb) to authenticated;
