-- Identity-free membership list for session hydration.
-- Callers must not select another user_id; archived restaurants are excluded so
-- the Expo read path stays aligned with private.is_restaurant_member.

create or replace function public.list_my_restaurant_memberships()
returns setof public.restaurant_memberships
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  return query
  select membership.*
  from public.restaurant_memberships membership
  join public.restaurants restaurant
    on restaurant.id = membership.restaurant_id
  where membership.user_id = actor_user_id
    and membership.status = 'active'
    and restaurant.archived_at is null
  order by membership.created_at asc;
end;
$$;

comment on function public.list_my_restaurant_memberships() is
  'Identity-free active membership reads bound to auth.uid(). Excludes archived restaurants. Pure read — does not mutate membership or restaurant rows.';

revoke all on function public.list_my_restaurant_memberships()
  from public, anon, authenticated, service_role;
grant execute on function public.list_my_restaurant_memberships()
  to authenticated;
