-- Persist optional per-line variance notes on inventory count sessions.
-- Notes stay on inventory_count_lines during draft/submit and copy into
-- inventory_movements.metadata.note when a count adjustment is approved.

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
  safe_note text;
  note_provided boolean;
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

    note_provided := entry ? 'note';
    safe_note := null;
    if note_provided then
      safe_note := nullif(btrim(coalesce(entry->>'note', '')), '');
      if safe_note is not null and char_length(safe_note) > 240 then
        raise exception 'Count line note is outside supported limits' using errcode = '22023';
      end if;
    end if;

    if note_provided then
      update public.inventory_count_lines
      set counted_quantity = counted,
          note = safe_note,
          updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id
        and session_id = p_session_id
        and inventory_item_id = item_id;
    else
      update public.inventory_count_lines
      set counted_quantity = counted,
          updated_at = clock_timestamp()
      where restaurant_id = p_restaurant_id
        and session_id = p_session_id
        and inventory_item_id = item_id;
    end if;

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

create or replace function private.service_approve_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  session_row public.inventory_count_sessions%rowtype;
  line_row public.inventory_count_lines%rowtype;
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_after numeric;
  changed_count integer := 0;
  line_count integer := 0;
  movement_metadata jsonb;
  safe_note text;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'submitted' then
    raise exception 'Submit the count session before approving adjustments' using errcode = '22023';
  end if;

  for line_row in
    select *
    from public.inventory_count_lines
    where session_id = p_session_id
    order by item_name, id
    for update
  loop
    line_count := line_count + 1;
    if line_row.counted_quantity is null then
      raise exception 'Count every item before approving the session' using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = line_row.inventory_item_id
    for update;
    if not found then
      raise exception 'Count line references an inventory item that is no longer available';
    end if;

    quantity_before := item_row.current_quantity;
    quantity_after := line_row.counted_quantity;
    if quantity_after is distinct from quantity_before then
      update public.inventory_items
      set current_quantity = quantity_after,
          last_updated = clock_timestamp()
      where restaurant_id = p_restaurant_id and id = line_row.inventory_item_id;

      movement_metadata := jsonb_build_object(
        'session_id', p_session_id,
        'system_quantity_at_start', line_row.system_quantity_at_start,
        'variance_from_system', quantity_after - line_row.system_quantity_at_start
      );
      safe_note := nullif(btrim(coalesce(line_row.note, '')), '');
      if safe_note is not null then
        movement_metadata := movement_metadata || jsonb_build_object('note', safe_note);
      end if;

      insert into public.inventory_movements (
        restaurant_id,
        inventory_item_id,
        actor_user_id,
        reason,
        quantity_before,
        quantity_after,
        source_workflow,
        metadata
      ) values (
        p_restaurant_id,
        line_row.inventory_item_id,
        p_actor_user_id,
        'manual_count',
        quantity_before,
        quantity_after,
        'approve_count_session',
        movement_metadata
      );
      changed_count := changed_count + 1;
    end if;
  end loop;

  if line_count < 1 then
    raise exception 'Count session has no lines to approve' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return private.inventory_count_session_detail(p_session_id)
    || jsonb_build_object('lines_changed', changed_count, 'lines_total', line_count);
end;
$$;

comment on function private.service_save_inventory_count_lines(uuid, uuid, uuid, jsonb) is
  'Saves draft counted quantities and optional variance notes for an in-progress session; available to staff counters.';
comment on function private.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) is
  'Approves a submitted count session, writes manual_count ledger rows (with optional line notes), and refreshes planning signals.';
