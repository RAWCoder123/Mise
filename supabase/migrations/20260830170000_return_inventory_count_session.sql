-- Managers can return a submitted inventory count session to in_progress so
-- staff can correct counted lines without discarding progress or writing the
-- inventory ledger. Approved and cancelled sessions remain closed.

create or replace function private.service_return_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'submitted' then
    raise exception 'Only a submitted count session can be returned for revision' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'in_progress',
      submitted_by = null,
      submitted_at = null,
      updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

-- Public service_role wrapper (Edge-only).
create or replace function public.service_return_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_return_inventory_count_session(
    p_actor_user_id,
    p_restaurant_id,
    p_session_id
  );
$$;

revoke all on function public.service_return_inventory_count_session(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_return_inventory_count_session(uuid, uuid, uuid)
  to service_role;

revoke all on function private.service_return_inventory_count_session(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.service_return_inventory_count_session(uuid, uuid, uuid)
  to service_role;

comment on function private.service_return_inventory_count_session(uuid, uuid, uuid) is
  'Returns a submitted count session to in_progress for revision; preserves counted lines and writes no inventory events.';
