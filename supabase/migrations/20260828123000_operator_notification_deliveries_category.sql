-- Additive deliveries attention category for operator Today/Home mutes.
-- Extends 20260827140000_operator_notification_preferences without rewriting
-- historical preference rows; normalize fills missing keys as enabled.

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
    'deliveries', true,
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
    'deliveries',
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

alter table public.users
  alter column notification_preferences set default jsonb_build_object(
    'inventory', true,
    'orders', true,
    'deliveries', true,
    'waste', true,
    'recipes_pos', true,
    'insights', true,
    'setup', true
  );

comment on column public.users.notification_preferences is
  'Operator Today/Home attention preferences only. Allowed keys: inventory, orders, deliveries, waste, recipes_pos, insights, setup with boolean values. Never use for restaurant authorization.';

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
      'deliveries',
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

revoke all on function public.update_my_notification_preferences(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.update_my_notification_preferences(jsonb) to authenticated;

-- Keep profile mutation RPC-only.
revoke update (notification_preferences) on table public.users from authenticated;

comment on function public.update_my_notification_preferences(jsonb) is
  'Identity-free operator notification preference update. Allowlisted category booleans only (includes deliveries); never use for restaurant authorization.';
