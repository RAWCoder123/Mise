-- Persist operator Today attention category preferences as bounded profile
-- metadata. This field is never an authorization input; restaurant authority
-- remains exclusively in active restaurant_memberships.
alter table public.users
  add column if not exists notification_preferences jsonb;

alter table public.users
  alter column notification_preferences set default jsonb_build_object(
    'inventory', true,
    'orders', true,
    'waste', true,
    'recipes_pos', true,
    'insights', true,
    'setup', true
  );

update public.users
set notification_preferences = jsonb_build_object(
  'inventory', true,
  'orders', true,
  'waste', true,
  'recipes_pos', true,
  'insights', true,
  'setup', true
)
where notification_preferences is null;

alter table public.users
  alter column notification_preferences set not null;

comment on column public.users.notification_preferences is
  'Operator Today attention preferences only. Allowed keys: inventory, orders, waste, recipes_pos, insights, setup with boolean values. Never use for restaurant authorization.';

create or replace function private.normalize_notification_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  category text;
  normalized jsonb := jsonb_build_object(
    'inventory', true,
    'orders', true,
    'waste', true,
    'recipes_pos', true,
    'insights', true,
    'setup', true
  );
begin
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    return normalized;
  end if;

  foreach category in array array[
    'inventory',
    'orders',
    'waste',
    'recipes_pos',
    'insights',
    'setup'
  ]
  loop
    if jsonb_typeof(p_preferences -> category) = 'boolean' then
      normalized := jsonb_set(normalized, array[category], p_preferences -> category, true);
    end if;
  end loop;

  return normalized;
end;
$$;

revoke all on function private.normalize_notification_preferences(jsonb)
  from public, anon, authenticated;
grant execute on function private.normalize_notification_preferences(jsonb)
  to service_role;

-- Identity-free profile reads prevent callers from probing another user ID.
create or replace function public.get_my_notification_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  selected_preferences jsonb;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select private.normalize_notification_preferences(profile.notification_preferences)
    into selected_preferences
  from public.users profile
  where profile.id = actor_user_id;

  if selected_preferences is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  return selected_preferences;
end;
$$;

create or replace function public.update_my_notification_preferences(p_preferences jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  updated_preferences jsonb;
  normalized jsonb;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_preferences is null or jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'Notification preferences are not supported' using errcode = '22023';
  end if;

  -- Reject unknown keys so clients cannot stash arbitrary profile blobs.
  if exists (
    select 1
    from jsonb_object_keys(p_preferences) as keys(key)
    where keys.key not in (
      'inventory',
      'orders',
      'waste',
      'recipes_pos',
      'insights',
      'setup'
    )
  ) then
    raise exception 'Notification preferences are not supported' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_each(p_preferences) as entry(key, value)
    where jsonb_typeof(entry.value) <> 'boolean'
  ) then
    raise exception 'Notification preferences are not supported' using errcode = '22023';
  end if;

  normalized := private.normalize_notification_preferences(p_preferences);

  update public.users profile
  set notification_preferences = normalized
  where profile.id = actor_user_id
  returning private.normalize_notification_preferences(profile.notification_preferences)
    into updated_preferences;

  if updated_preferences is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  return updated_preferences;
end;
$$;

revoke all on function public.get_my_notification_preferences()
  from public, anon, authenticated, service_role;
revoke all on function public.update_my_notification_preferences(jsonb)
  from public, anon, authenticated, service_role;

grant execute on function public.get_my_notification_preferences() to authenticated;
grant execute on function public.update_my_notification_preferences(jsonb) to authenticated;

-- Keep profile mutation RPC-only. Existing authenticated SELECT remains
-- protected by the own-profile RLS policy; no direct UPDATE capability is added.
revoke update (notification_preferences) on table public.users from authenticated;

comment on function public.get_my_notification_preferences() is
  'Identity-free operator notification preference read. Target row is always auth.uid().';

comment on function public.update_my_notification_preferences(jsonb) is
  'Identity-free operator notification preference update. Allowlisted category booleans only; never use for restaurant authorization.';
