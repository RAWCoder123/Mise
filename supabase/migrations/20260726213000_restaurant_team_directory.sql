-- Team management directory RPCs.
--
-- Membership mutations stay on the existing guarded RPCs
-- (add/update/remove_restaurant_member). This migration adds the two reads the
-- team screen needs:
--   * list_restaurant_members: memberships joined with profile name and auth
--     email, visible to any active member of the restaurant;
--   * find_restaurant_member_candidate: owner/admin-only email -> auth user id
--     lookup so an operator can be added by email. Returns null when no Mise
--     account uses the email (the client tells the operator to have the person
--     create an account first).

create or replace function public.list_restaurant_members(p_restaurant_id uuid)
returns table (
  restaurant_id uuid,
  user_id uuid,
  role text,
  status text,
  name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Restaurant team access denied' using errcode = '42501';
  end if;

  return query
  select
    membership.restaurant_id,
    membership.user_id,
    membership.role,
    membership.status,
    profile.name,
    auth_user.email::text,
    membership.created_at,
    membership.updated_at
  from public.restaurant_memberships membership
  left join public.users profile on profile.id = membership.user_id
  left join auth.users auth_user on auth_user.id = membership.user_id
  where membership.restaurant_id = p_restaurant_id
  order by
    pg_catalog.array_position(array['owner', 'admin', 'manager', 'staff'], membership.role),
    membership.created_at;
end;
$$;

create or replace function public.find_restaurant_member_candidate(
  p_restaurant_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  candidate_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin'])
  then
    raise exception 'Membership access denied' using errcode = '42501';
  end if;
  if normalized_email is null
    or pg_catalog.length(normalized_email) not between 3 and 254
    or pg_catalog.strpos(normalized_email, '@') = 0
  then
    raise exception 'Member email is invalid' using errcode = '22023';
  end if;

  select auth_user.id into candidate_user_id
  from auth.users auth_user
  where pg_catalog.lower(auth_user.email) = normalized_email
  limit 1;

  return candidate_user_id;
end;
$$;

revoke all on function public.list_restaurant_members(uuid) from public, anon, authenticated, service_role;
revoke all on function public.find_restaurant_member_candidate(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.list_restaurant_members(uuid) to authenticated;
grant execute on function public.find_restaurant_member_candidate(uuid, text) to authenticated;

comment on function public.list_restaurant_members(uuid) is
  'Team directory for active restaurant members: membership rows joined with profile names and auth emails.';
comment on function public.find_restaurant_member_candidate(uuid, text) is
  'Owner/admin-only lookup of an auth user id by email for team invitations. Null means no Mise account uses the email.';
