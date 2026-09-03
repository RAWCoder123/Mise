-- Allow managers to reassign open shared restaurant tasks. Assignment remains
-- gated by private.enforce_restaurant_task_assignee for active membership and
-- required_role. Completed/cancelled tasks stay closed to reassignment.

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
    'task_cancelled', 'task_reassigned',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded'
  ));

create or replace function public.reassign_restaurant_task(
  p_restaurant_id uuid,
  p_task_id uuid,
  p_assignee_user_id uuid default null
)
returns public.restaurant_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  task_row public.restaurant_tasks;
  previous_assignee_user_id uuid;
begin
  if actor_user_id is null or not exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Manager role required to reassign a task' using errcode = '42501';
  end if;

  select task.* into task_row
  from public.restaurant_tasks task
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  for update;
  if not found then
    raise exception 'Restaurant task not found' using errcode = 'P0002';
  end if;

  if task_row.status in ('completed', 'cancelled') then
    raise exception 'Only open restaurant tasks can be reassigned' using errcode = '22023';
  end if;

  if task_row.status not in ('waiting', 'blocked', 'in_progress', 'could_not_verify') then
    raise exception 'Only open restaurant tasks can be reassigned' using errcode = '22023';
  end if;

  if task_row.assignee_user_id is not distinct from p_assignee_user_id then
    return task_row;
  end if;

  previous_assignee_user_id := task_row.assignee_user_id;

  update public.restaurant_tasks task
  set assignee_user_id = p_assignee_user_id
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  returning * into task_row;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_reassigned',
    'Restaurant task reassigned',
    case
      when task_row.assignee_user_id is null then format('%s is unassigned and open to eligible teammates.', task_row.title)
      else format('%s was reassigned to a different teammate.', task_row.title)
    end,
    'scheduled',
    format('reassigned:%s', extract(epoch from task_row.updated_at)::bigint),
    jsonb_build_object(
      'previousAssigneeUserId', previous_assignee_user_id,
      'assigneeUserId', task_row.assignee_user_id
    )
  );

  return task_row;
end;
$$;

revoke all on function public.reassign_restaurant_task(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reassign_restaurant_task(uuid, uuid, uuid)
  to authenticated;

comment on function public.reassign_restaurant_task(uuid, uuid, uuid) is
  'Manager-only reassignment of open shared restaurant task assignees; membership and required_role stay trigger-enforced.';
