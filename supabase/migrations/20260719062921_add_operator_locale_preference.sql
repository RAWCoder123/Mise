-- Persist operator language as bounded profile metadata. This field is never
-- an authorization input; restaurant authority remains exclusively in active
-- restaurant_memberships.
alter table public.users
  add column if not exists preferred_locale text;

alter table public.users
  drop constraint if exists users_preferred_locale_allowlist_check;

alter table public.users
  add constraint users_preferred_locale_allowlist_check
  check (preferred_locale is null or preferred_locale in ('en', 'es', 'zh-Hans'));

comment on column public.users.preferred_locale is
  'Operator display preference only. Allowed values: en, es, zh-Hans. Never use for restaurant authorization.';

-- Identity-free profile reads prevent callers from probing another user ID.
create or replace function public.get_my_preferred_locale()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  selected_locale text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select profile.preferred_locale into selected_locale
  from public.users profile
  where profile.id = actor_user_id;

  return selected_locale;
end;
$$;

-- The caller supplies only an allowlisted locale. The target profile always
-- comes from auth.uid(); user, restaurant, role, and membership fields cannot
-- be selected or changed through this function.
create or replace function public.update_my_preferred_locale(p_locale text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  updated_locale text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('en', 'es', 'zh-Hans') then
    raise exception 'Preferred locale is not supported' using errcode = '22023';
  end if;

  update public.users profile
  set preferred_locale = p_locale
  where profile.id = actor_user_id
  returning profile.preferred_locale into updated_locale;

  if updated_locale is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  return updated_locale;
end;
$$;

-- Keep profile mutation RPC-only. Existing authenticated SELECT remains
-- protected by the own-profile RLS policy; no direct UPDATE capability is added.
revoke update (preferred_locale) on table public.users from authenticated;

revoke all on function public.get_my_preferred_locale() from public, anon, authenticated, service_role;
revoke all on function public.update_my_preferred_locale(text) from public, anon, authenticated, service_role;

grant execute on function public.get_my_preferred_locale() to authenticated;
grant execute on function public.update_my_preferred_locale(text) to authenticated;
