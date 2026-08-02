-- Identity-free operator display-name reads. Mutations remain Edge-owned via
-- service_update_my_profile; this RPC only returns the caller's stored name.
-- Display names are never authorization inputs.

create or replace function public.get_my_display_name()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  selected_name text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select pg_catalog.nullif(pg_catalog.btrim(profile.name), '') into selected_name
  from public.users profile
  where profile.id = actor_user_id;

  return selected_name;
end;
$$;

comment on function public.get_my_display_name() is
  'Identity-free profile reads prevent callers from probing another user ID. Returns the authenticated operator display name only. Never use for restaurant authorization.';

revoke all on function public.get_my_display_name()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_display_name()
  to authenticated;
