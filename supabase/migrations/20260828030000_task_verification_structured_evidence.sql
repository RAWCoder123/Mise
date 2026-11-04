-- Bind count/receipt task verification to real operational evidence.
-- Free-text notes alone can no longer complete count or receipt verification tasks.

create or replace function public.complete_restaurant_task(
  p_restaurant_id uuid,
  p_task_id uuid,
  p_completion_result text,
  p_completion_evidence jsonb default '[]'::jsonb
)
returns public.restaurant_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  task_row public.restaurant_tasks;
  unblocked_task public.restaurant_tasks;
  evidence_entry jsonb;
  count_session_id text;
  count_session_uuid uuid;
  count_session_status text;
  supplier_order_id text;
  supplier_order_uuid uuid;
  supplier_order_status text;
  typed_evidence_found boolean := false;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active';
  if actor_role is null then
    raise exception 'Active restaurant membership required' using errcode = '42501';
  end if;

  select task.* into task_row
  from public.restaurant_tasks task
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  for update;
  if not found then
    raise exception 'Restaurant task not found' using errcode = 'P0002';
  end if;
  if task_row.status = 'completed' then
    return task_row;
  end if;
  if task_row.status = 'cancelled' then
    raise exception 'Cancelled tasks cannot be completed' using errcode = '22023';
  end if;
  if task_row.assignee_user_id is not null
    and task_row.assignee_user_id <> actor_user_id
    and actor_role not in ('owner', 'admin', 'manager') then
    raise exception 'Only the assignee or a manager may complete this task'
      using errcode = '42501';
  end if;
  if task_row.required_role = 'manager' and actor_role not in ('owner', 'admin', 'manager') then
    raise exception 'Manager role required to complete this task' using errcode = '42501';
  end if;
  if task_row.required_role = 'owner_admin' and actor_role not in ('owner', 'admin') then
    raise exception 'Owner or admin role required to complete this task' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.restaurant_task_dependencies dependency
    join public.restaurant_tasks prerequisite
      on prerequisite.restaurant_id = dependency.restaurant_id
     and prerequisite.id = dependency.depends_on_task_id
    where dependency.restaurant_id = p_restaurant_id
      and dependency.task_id = p_task_id
      and prerequisite.status <> 'completed'
  ) then
    raise exception 'Task prerequisites are not complete' using errcode = '55000';
  end if;
  if nullif(trim(p_completion_result), '') is null or length(trim(p_completion_result)) > 1000 then
    raise exception 'A bounded completion result is required' using errcode = '22023';
  end if;
  if p_completion_evidence is null or jsonb_typeof(p_completion_evidence) <> 'array'
    or jsonb_array_length(p_completion_evidence) > 32 then
    raise exception 'Completion evidence must be a bounded array' using errcode = '22023';
  end if;
  if task_row.verification_required and jsonb_array_length(p_completion_evidence) = 0 then
    raise exception 'Verification evidence is required for this task' using errcode = '22023';
  end if;

  if task_row.verification_method = 'count' then
    count_session_id := null;
    for evidence_entry in
      select value
      from jsonb_array_elements(p_completion_evidence) as elements(value)
    loop
      if evidence_entry->>'type' = 'count_session' then
        count_session_id := nullif(trim(evidence_entry->>'countSessionId'), '');
        exit when count_session_id is not null;
      end if;
    end loop;
    if count_session_id is null then
      raise exception 'Count verification requires a linked inventory count session'
        using errcode = '22023';
    end if;
    begin
      count_session_uuid := count_session_id::uuid;
    exception
      when others then
        raise exception 'Count verification session id is invalid' using errcode = '22023';
    end;
    select session.status into count_session_status
    from public.inventory_count_sessions session
    where session.restaurant_id = p_restaurant_id
      and session.id = count_session_uuid;
    if not found then
      raise exception 'Count verification session was not found for this restaurant'
        using errcode = '22023';
    end if;
    if count_session_status not in ('submitted', 'approved') then
      raise exception 'Count verification requires a submitted or approved count session'
        using errcode = '22023';
    end if;

  elsif task_row.verification_method = 'receipt' then
    supplier_order_id := null;
    for evidence_entry in
      select value
      from jsonb_array_elements(p_completion_evidence) as elements(value)
    loop
      if evidence_entry->>'type' = 'supplier_receipt' then
        supplier_order_id := nullif(trim(evidence_entry->>'supplierOrderId'), '');
        exit when supplier_order_id is not null;
      end if;
    end loop;
    if supplier_order_id is null then
      raise exception 'Receipt verification requires a completed supplier order receipt'
        using errcode = '22023';
    end if;
    begin
      supplier_order_uuid := supplier_order_id::uuid;
    exception
      when others then
        raise exception 'Receipt verification order id is invalid' using errcode = '22023';
    end;
    if task_row.related_order_id is not null
      and task_row.related_order_id <> supplier_order_uuid then
      raise exception 'Receipt verification must reference the related supplier order'
        using errcode = '22023';
    end if;
    select orders.status into supplier_order_status
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = supplier_order_uuid;
    if not found then
      raise exception 'Receipt verification order was not found for this restaurant'
        using errcode = '22023';
    end if;
    if supplier_order_status <> 'completed' then
      raise exception 'Receipt verification requires a completed supplier order'
        using errcode = '22023';
    end if;

  elsif task_row.verification_method in ('manager_review', 'photo', 'source_state') then
    typed_evidence_found := false;
    for evidence_entry in
      select value
      from jsonb_array_elements(p_completion_evidence) as elements(value)
    loop
      if evidence_entry->>'type' = task_row.verification_method then
        typed_evidence_found := true;
        exit;
      end if;
    end loop;
    if not typed_evidence_found then
      raise exception 'Verification evidence must include a matching typed entry'
        using errcode = '22023';
    end if;
  end if;

  update public.restaurant_tasks task
  set status = 'completed',
      completion_result = trim(p_completion_result),
      completion_evidence = p_completion_evidence,
      completed_at = now(),
      completed_by = actor_user_id
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  returning * into task_row;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_completed',
    'Restaurant task completed',
    format('%s · Result: %s', task_row.title, task_row.completion_result),
    'completed',
    'completed',
    jsonb_build_object('completionResult', task_row.completion_result)
  );

  for unblocked_task in
    update public.restaurant_tasks dependent
    set status = 'waiting'
    where dependent.restaurant_id = p_restaurant_id
      and dependent.status = 'blocked'
      and exists (
        select 1 from public.restaurant_task_dependencies dependency
        where dependency.restaurant_id = p_restaurant_id
          and dependency.task_id = dependent.id
          and dependency.depends_on_task_id = p_task_id
      )
      and not exists (
        select 1
        from public.restaurant_task_dependencies dependency
        join public.restaurant_tasks prerequisite
          on prerequisite.restaurant_id = dependency.restaurant_id
         and prerequisite.id = dependency.depends_on_task_id
        where dependency.restaurant_id = p_restaurant_id
          and dependency.task_id = dependent.id
          and prerequisite.status <> 'completed'
      )
    returning dependent.*
  loop
    perform private.append_restaurant_task_activity(
      unblocked_task,
      'task_unblocked',
      'Restaurant task is ready',
      format('%s moved to ready because its prerequisite work was completed.', unblocked_task.title),
      'scheduled',
      format('unblocked:%s', p_task_id),
      jsonb_build_object('completedDependencyId', p_task_id)
    );
  end loop;

  return task_row;
end;
$$;

revoke all on function public.complete_restaurant_task(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_restaurant_task(uuid, uuid, text, jsonb)
  to authenticated;

comment on function public.complete_restaurant_task(uuid, uuid, text, jsonb) is
  'Completes a restaurant task with result + evidence. Count/receipt methods require live tenant count-session or completed supplier-order references.';
