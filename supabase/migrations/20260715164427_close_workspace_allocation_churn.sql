-- Close the lifetime workspace-allocation bypass where an owner could disable
-- or delete an active membership and immediately recover quota.

create table private.restaurant_workspace_allocations (
  restaurant_id uuid primary key,
  creator_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.restaurant_workspace_allocations enable row level security;
revoke all on table private.restaurant_workspace_allocations from public, anon, authenticated, service_role;

create index restaurant_workspace_allocations_creator_idx
on private.restaurant_workspace_allocations (creator_user_id, created_at);

-- Applied databases predate allocation provenance. The earliest retained owner
-- membership is the narrowest deterministic backfill and prevents existing
-- workspaces from disappearing from the lifetime quota when status changes.
insert into private.restaurant_workspace_allocations (restaurant_id, creator_user_id, created_at)
select distinct on (membership.restaurant_id)
  membership.restaurant_id,
  membership.user_id,
  membership.created_at
from public.restaurant_memberships membership
where membership.role = 'owner'
order by membership.restaurant_id, membership.created_at, membership.id
on conflict (restaurant_id) do nothing;

create or replace function private.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_restaurant public.restaurants;
  lifetime_workspace_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  restaurant_name := trim(restaurant_name);
  if length(restaurant_name) not between 1 and 120 then
    raise exception 'Restaurant name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || E'\x1fowner-workspace-quota', 0));
  select count(*)::integer into lifetime_workspace_count
  from private.restaurant_workspace_allocations allocation
  where allocation.creator_user_id = current_user_id;
  if lifetime_workspace_count >= 5 then
    raise exception 'A user may create at most five restaurant workspaces' using errcode = '54000';
  end if;

  insert into public.restaurants (name, cuisine_type)
  values (restaurant_name, nullif(trim(restaurant_cuisine_type), ''))
  returning * into new_restaurant;
  insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
  values (new_restaurant.id, current_user_id, 'owner', 'active');
  insert into private.restaurant_workspace_allocations (restaurant_id, creator_user_id)
  values (new_restaurant.id, current_user_id);
  return new_restaurant;
end;
$$;

revoke all on function private.create_restaurant_with_owner(text, text) from public, anon;
grant execute on function private.create_restaurant_with_owner(text, text) to authenticated;

create or replace function private.guard_last_active_restaurant_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  protected_restaurant_id uuid := old.restaurant_id;
  replacement_is_active_owner boolean := false;
begin
  -- Cascades from an explicitly deleted restaurant or Auth user must retain
  -- normal account/workspace deletion semantics.
  if not exists (
    select 1 from public.restaurants restaurant where restaurant.id = protected_restaurant_id
  ) or not exists (
    select 1 from auth.users auth_user where auth_user.id = old.user_id
  ) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.role <> 'owner' or old.status <> 'active' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    replacement_is_active_owner := new.restaurant_id = old.restaurant_id
      and new.role = 'owner'
      and new.status = 'active';
  end if;
  if replacement_is_active_owner then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(protected_restaurant_id::text || E'\x1flast-active-owner', 0));
  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = protected_restaurant_id
      and membership.id <> old.id
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'A restaurant must retain at least one active owner' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_last_active_restaurant_owner() from public, anon, authenticated, service_role;

drop trigger if exists guard_last_active_restaurant_owner on public.restaurant_memberships;
create trigger guard_last_active_restaurant_owner
before delete or update of restaurant_id, user_id, role, status
on public.restaurant_memberships
for each row execute function private.guard_last_active_restaurant_owner();
