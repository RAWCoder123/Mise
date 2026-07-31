-- Allow active staff to begin, save, and submit inventory count sessions.
-- Manager/owner/admin approval (and cancel) remain required before ledger writes.

create or replace function private.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  open_session_id uuid;
  session_id uuid;
  item_count integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Count session note is outside supported limits' using errcode = '22023';
  end if;

  select id into open_session_id
  from public.inventory_count_sessions
  where restaurant_id = p_restaurant_id
    and status in ('in_progress', 'submitted')
  limit 1;
  if open_session_id is not null then
    raise exception 'A count session is already open for this restaurant' using errcode = '23505';
  end if;

  select count(*)::integer into item_count
  from public.inventory_items
  where restaurant_id = p_restaurant_id;
  if item_count < 1 then
    raise exception 'Add inventory items before starting a count session' using errcode = '22023';
  end if;
  if item_count > 250 then
    raise exception 'Count sessions support at most 250 items' using errcode = '22023';
  end if;

  insert into public.inventory_count_sessions (
    restaurant_id, status, started_by, started_at, note
  ) values (
    p_restaurant_id, 'in_progress', p_actor_user_id, clock_timestamp(), safe_note
  )
  returning id into session_id;

  insert into public.inventory_count_lines (
    restaurant_id,
    session_id,
    inventory_item_id,
    item_name,
    unit,
    system_quantity_at_start
  )
  select
    p_restaurant_id,
    session_id,
    item.id,
    item.item_name,
    item.unit,
    item.current_quantity
  from public.inventory_items as item
  where item.restaurant_id = p_restaurant_id
  order by item.item_name, item.id;

  return private.inventory_count_session_detail(session_id);
end;
$$;

create or replace function private.service_save_inventory_count_lines(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_row public.inventory_count_sessions%rowtype;
  line_count integer;
  updated_count integer := 0;
  entry jsonb;
  item_id uuid;
  counted numeric;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Count lines payload must be an array' using errcode = '22023';
  end if;
  line_count := jsonb_array_length(p_lines);
  if line_count < 1 or line_count > 250 then
    raise exception 'Count lines payload size is outside supported limits' using errcode = '22023';
  end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Only an in-progress count session can be edited' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(p_lines)
  loop
    begin
      item_id := (entry->>'inventory_item_id')::uuid;
    exception when others then
      raise exception 'Count line inventory_item_id is invalid' using errcode = '22023';
    end;
    begin
      counted := (entry->>'counted_quantity')::numeric;
    exception when others then
      raise exception 'Count line counted_quantity is invalid' using errcode = '22023';
    end;
    if counted is null or counted < 0 or counted > 1000000 then
      raise exception 'Counted quantity is outside supported limits' using errcode = '22023';
    end if;

    update public.inventory_count_lines
    set counted_quantity = counted,
        updated_at = clock_timestamp()
    where restaurant_id = p_restaurant_id
      and session_id = p_session_id
      and inventory_item_id = item_id;
    if found then
      updated_count := updated_count + 1;
    else
      raise exception 'One or more count lines are not part of this session' using errcode = 'P0002';
    end if;
  end loop;

  if updated_count <> line_count then
    raise exception 'One or more count lines are not part of this session' using errcode = 'P0002';
  end if;

  update public.inventory_count_sessions
  set updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

create or replace function private.service_submit_inventory_count_session(
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
  incomplete_count integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'in_progress' then
    raise exception 'Only an in-progress count session can be submitted' using errcode = '22023';
  end if;

  select count(*)::integer into incomplete_count
  from public.inventory_count_lines
  where session_id = p_session_id and counted_quantity is null;
  if incomplete_count > 0 then
    raise exception 'Count every item before submitting the session' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'submitted',
      submitted_by = p_actor_user_id,
      submitted_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  return private.inventory_count_session_detail(p_session_id);
end;
$$;

comment on function private.service_begin_inventory_count_session(uuid, uuid, text) is
  'Starts a multi-item count session for owner/admin/manager/staff; ledger changes still require manager approval.';
comment on function private.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) is
  'Saves draft counted quantities for an in-progress session; available to staff counters.';
comment on function private.service_submit_inventory_count_session(uuid, uuid, uuid) is
  'Submits a complete count session for manager/owner/admin approval.';
