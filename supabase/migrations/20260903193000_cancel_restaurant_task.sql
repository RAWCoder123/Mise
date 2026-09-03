-- Allow managers to cancel open shared restaurant tasks with an auditable activity
-- event. Cancel is fail-closed when open dependents still require this task as a
-- completed prerequisite. Completed tasks stay reopen-only; cancelled stays terminal.

alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'task_reopened', 'task_unblocked',
    'task_cancelled',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded'
  ));

create or replace function public.cancel_restaurant_task(
  p_restaurant_id uuid,
  p_task_id uuid,
  p_cancel_reason text default null
)
returns public.restaurant_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  task_row public.restaurant_tasks;
  cancel_reason text := nullif(trim(coalesce(p_cancel_reason, '')), '');
begin
  if actor_user_id is null or not exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Manager role required to cancel a task' using errcode = '42501';
  end if;

  if cancel_reason is not null and length(cancel_reason) > 500 then
    raise exception 'Cancel reason must be 500 characters or fewer' using errcode = '22023';
  end if;

  select task.* into task_row
  from public.restaurant_tasks task
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  for update;
  if not found then
    raise exception 'Restaurant task not found' using errcode = 'P0002';
  end if;

  if task_row.status = 'cancelled' then
    return task_row;
  end if;

  if task_row.status = 'completed' then
    raise exception 'Completed tasks cannot be cancelled; reopen them first'
      using errcode = '22023';
  end if;

  if task_row.status not in ('waiting', 'blocked', 'in_progress', 'could_not_verify') then
    raise exception 'Only open restaurant tasks can be cancelled' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.restaurant_task_dependencies dependency
    join public.restaurant_tasks dependent
      on dependent.restaurant_id = dependency.restaurant_id
     and dependent.id = dependency.task_id
    where dependency.restaurant_id = p_restaurant_id
      and dependency.depends_on_task_id = p_task_id
      and dependent.status in ('waiting', 'blocked', 'in_progress', 'could_not_verify')
  ) then
    raise exception 'Open dependent tasks still require this prerequisite'
      using errcode = '55000';
  end if;

  update public.restaurant_tasks task
  set status = 'cancelled',
      completion_result = null,
      completion_evidence = '[]'::jsonb,
      completed_at = null,
      completed_by = null
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  returning * into task_row;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_cancelled',
    'Restaurant task cancelled',
    case
      when cancel_reason is null then format('%s was cancelled and removed from the operating plan.', task_row.title)
      else format('%s was cancelled: %s', task_row.title, cancel_reason)
    end,
    'cancelled',
    format('cancelled:%s', extract(epoch from task_row.updated_at)::bigint),
    case
      when cancel_reason is null then '{}'::jsonb
      else jsonb_build_object('cancelReason', cancel_reason)
    end
  );

  return task_row;
end;
$$;

revoke all on function public.cancel_restaurant_task(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_restaurant_task(uuid, uuid, text)
  to authenticated;

comment on function public.cancel_restaurant_task(uuid, uuid, text) is
  'Manager-only cancel for open shared restaurant tasks; fails closed when open dependents remain.';
