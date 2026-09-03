-- Allow managers to reschedule open shared restaurant tasks (timing bucket and
-- optional due_at). Create remains the only insert path; cancel/reassign stay
-- separate mutations. Completed and cancelled tasks stay closed to reschedule.

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
    'task_cancelled', 'task_reassigned', 'task_rescheduled',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded'
  ));

create or replace function public.reschedule_restaurant_task(
  p_restaurant_id uuid,
  p_task_id uuid,
  p_timing_bucket text,
  p_due_at timestamptz default null
)
returns public.restaurant_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  task_row public.restaurant_tasks;
  previous_timing_bucket text;
  previous_due_at timestamptz;
begin
  if actor_user_id is null or not exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Manager role required to reschedule a task' using errcode = '42501';
  end if;

  if p_timing_bucket is null or p_timing_bucket not in ('now', 'up_next', 'later') then
    raise exception 'Task timing is invalid' using errcode = '22023';
  end if;

  select task.* into task_row
  from public.restaurant_tasks task
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  for update;
  if not found then
    raise exception 'Restaurant task not found' using errcode = 'P0002';
  end if;

  if task_row.status in ('completed', 'cancelled') then
    raise exception 'Only open restaurant tasks can be rescheduled' using errcode = '22023';
  end if;

  if task_row.status not in ('waiting', 'blocked', 'in_progress', 'could_not_verify') then
    raise exception 'Only open restaurant tasks can be rescheduled' using errcode = '22023';
  end if;

  if task_row.timing_bucket is not distinct from p_timing_bucket
    and task_row.due_at is not distinct from p_due_at
  then
    return task_row;
  end if;

  previous_timing_bucket := task_row.timing_bucket;
  previous_due_at := task_row.due_at;

  update public.restaurant_tasks task
  set timing_bucket = p_timing_bucket,
      due_at = p_due_at
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  returning * into task_row;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_rescheduled',
    'Restaurant task rescheduled',
    format('%s was moved to the %s operating-plan bucket.', task_row.title, replace(task_row.timing_bucket, '_', ' ')),
    'scheduled',
    format('rescheduled:%s', extract(epoch from task_row.updated_at)::bigint),
    jsonb_build_object(
      'previousTimingBucket', previous_timing_bucket,
      'timingBucket', task_row.timing_bucket,
      'previousDueAt', previous_due_at,
      'dueAt', task_row.due_at
    )
  );

  return task_row;
end;
$$;

revoke all on function public.reschedule_restaurant_task(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.reschedule_restaurant_task(uuid, uuid, text, timestamptz)
  to authenticated;

comment on function public.reschedule_restaurant_task(uuid, uuid, text, timestamptz) is
  'Manager-only reschedule of open shared restaurant task timing_bucket and optional due_at.';
