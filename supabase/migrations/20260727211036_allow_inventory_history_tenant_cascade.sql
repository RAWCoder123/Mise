-- Inventory history is immutable while its restaurant exists. Mark only the
-- transaction window owned by a parent restaurant DELETE statement so its FK
-- cascade can remove tenant history.
create or replace function private.mark_inventory_event_tenant_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.set_config(
    'mise.inventory_event_tenant_delete',
    'true',
    true
  );
  return null;
end;
$$;

drop trigger if exists mark_inventory_event_tenant_delete_start
on public.restaurants;
create trigger mark_inventory_event_tenant_delete_start
before delete on public.restaurants
for each statement execute function private.mark_inventory_event_tenant_delete();

create or replace function private.bump_restaurant_planning_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid :=
    case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
begin
  if pg_catalog.current_setting(
    'mise.inventory_event_tenant_delete',
    true
  ) = 'true'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  insert into private.restaurant_signal_state (
    restaurant_id, planning_revision, signals_revision, status, updated_at
  ) values (
    target_restaurant_id, 1, 0, 'pending', now()
  )
  on conflict (restaurant_id) do update
  set planning_revision = private.restaurant_signal_state.planning_revision + 1,
      status = 'pending',
      updated_at = now();
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.bump_recommendation_history_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid :=
    case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
  should_bump boolean := false;
begin
  if pg_catalog.current_setting(
    'mise.inventory_event_tenant_delete',
    true
  ) = 'true'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    should_bump := new.status in ('approved', 'dismissed', 'ordered');
  elsif tg_op = 'DELETE' then
    should_bump := old.status in ('approved', 'dismissed', 'ordered');
  else
    should_bump := old.status is distinct from new.status
      or (
        new.status in ('approved', 'ordered')
        and old.recommended_quantity is distinct from new.recommended_quantity
      );
  end if;

  if should_bump then
    insert into private.restaurant_signal_state (
      restaurant_id, planning_revision, signals_revision, status, updated_at
    ) values (target_restaurant_id, 1, 0, 'pending', now())
    on conflict (restaurant_id) do update
    set planning_revision = private.restaurant_signal_state.planning_revision + 1,
        status = 'pending',
        updated_at = now();
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.reject_inventory_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting(
      'mise.inventory_event_tenant_delete',
      true
    ) = 'true'
  then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.actor_user_id is not null
    and new.actor_user_id is null
    and not exists (
      select 1
      from auth.users auth_user
      where auth_user.id = old.actor_user_id
    )
    and (
      pg_catalog.to_jsonb(new) - 'actor_user_id'
    ) is not distinct from (
      pg_catalog.to_jsonb(old) - 'actor_user_id'
    )
  then
    return new;
  end if;

  raise exception 'Inventory events are append-only' using errcode = '55000';
end;
$$;

revoke all on function private.mark_inventory_event_tenant_delete()
  from public, anon, authenticated, service_role;
revoke all on function private.bump_restaurant_planning_revision()
  from public, anon, authenticated, service_role;
revoke all on function private.bump_recommendation_history_revision()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_inventory_event_mutation()
  from public, anon, authenticated, service_role;

comment on function private.reject_inventory_event_mutation() is
  'Blocks direct event updates/deletes while permitting auth actor anonymization and whole-restaurant FK cascade.';
