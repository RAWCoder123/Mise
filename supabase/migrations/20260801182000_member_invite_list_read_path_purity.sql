-- Stop mutating invite rows from the Expo list/read path.
-- list_restaurant_member_invites previously UPDATE'd pending invites to expired as a
-- side effect of Settings → Team. Claim/revoke write paths already persist expiry;
-- reads must stay pure and compute effective status instead.

create or replace function public.list_restaurant_member_invites(
  p_restaurant_id uuid
)
returns table (
  id uuid,
  restaurant_id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  claimed_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null then
    raise exception 'Restaurant is required' using errcode = '22023';
  end if;

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active';

  if actor_role is null or actor_role not in ('owner', 'admin', 'manager') then
    raise exception 'Membership access denied' using errcode = '42501';
  end if;

  return query
  select
    invite.id,
    invite.restaurant_id,
    invite.email,
    invite.role,
    case
      when invite.status = 'pending' and invite.expires_at <= pg_catalog.now() then 'expired'
      else invite.status
    end as status,
    invite.expires_at,
    invite.created_at,
    invite.claimed_at,
    invite.revoked_at
  from public.restaurant_member_invites invite
  where invite.restaurant_id = p_restaurant_id
    and invite.status in ('pending', 'claimed', 'revoked', 'expired')
  order by
    case
      when invite.status = 'pending' and invite.expires_at <= pg_catalog.now() then 3
      when invite.status = 'pending' then 0
      when invite.status = 'claimed' then 1
      when invite.status = 'revoked' then 2
      else 3
    end,
    invite.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_restaurant_member_invites(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.list_restaurant_member_invites(uuid)
  to authenticated;

comment on function public.list_restaurant_member_invites(uuid) is
  'Read-only recent restaurant member invites without exposing claim token hashes. Does not mutate invite rows; expired pending invites are returned with effective status expired.';
