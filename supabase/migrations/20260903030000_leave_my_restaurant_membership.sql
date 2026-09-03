-- Allow non-owner operators to leave a restaurant workspace without deleting
-- their Mise account. Owners remain blocked: transfer ownership or use account
-- deletion so a restaurant cannot be orphaned by self-removal.

create or replace function public.leave_my_restaurant_membership(
  p_restaurant_id uuid
)
returns public.restaurant_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_membership public.restaurant_memberships;
  left_membership public.restaurant_memberships;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null then
    raise exception 'Restaurant required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1fmembership-authority', 0)
  );

  select membership.*
  into actor_membership
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
  for update;

  if not found then
    raise exception 'Membership target is unavailable' using errcode = 'P0002';
  end if;

  if actor_membership.status is distinct from 'active' then
    raise exception 'Active membership required' using errcode = '42501';
  end if;

  if actor_membership.role = 'owner' then
    raise exception 'Owners cannot leave without transferring ownership' using errcode = '42501';
  end if;

  delete from public.restaurant_memberships membership
  where membership.id = actor_membership.id
  returning * into left_membership;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'membership_left',
    'restaurant_memberships',
    left_membership.id,
    jsonb_build_object(
      'role', left_membership.role,
      'userId', actor_user_id
    )
  );

  return left_membership;
end;
$$;

comment on function public.leave_my_restaurant_membership(uuid) is
  'Authenticated non-owners may leave their own active restaurant membership. Owners are blocked.';

revoke all on function public.leave_my_restaurant_membership(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.leave_my_restaurant_membership(uuid) to authenticated;
