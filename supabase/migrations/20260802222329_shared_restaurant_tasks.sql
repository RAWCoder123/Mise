-- Durable, shared restaurant tasks for the daily operating plan.
--
-- Restaurant-wide work must not live only on one operator's device. This
-- migration adds tenant-scoped task state, dependencies, verification, and
-- transactional activity history. Authenticated clients may read through RLS
-- but may mutate tasks only through the bounded RPCs below.

create table if not exists public.restaurant_tasks (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  location_id uuid,
  origin text not null default 'human' check (origin in (
    'human', 'mise', 'automated', 'approval', 'verification'
  )),
  title text not null check (length(trim(title)) between 1 and 160),
  detail text check (detail is null or length(trim(detail)) between 1 and 2000),
  operational_category text not null default 'other' check (operational_category in (
    'inventory', 'orders', 'prep', 'service', 'team', 'cleaning',
    'maintenance', 'deliveries', 'closing', 'integrations', 'other'
  )),
  priority text not null default 'normal' check (priority in (
    'urgent', 'high', 'normal', 'low'
  )),
  status text not null default 'waiting' check (status in (
    'waiting', 'blocked', 'in_progress', 'completed', 'cancelled',
    'could_not_verify'
  )),
  timing_bucket text not null default 'now' check (timing_bucket in (
    'now', 'up_next', 'later'
  )),
  due_at timestamptz,
  service_window text check (service_window is null or service_window in (
    'before_lunch', 'before_prep', 'before_supplier_cutoff',
    'before_dinner_service', 'during_closing', 'end_of_day', 'custom'
  )),
  window_start timestamptz,
  window_end timestamptz,
  required_role text not null default 'member' check (required_role in (
    'member', 'manager', 'owner_admin'
  )),
  assignee_user_id uuid references auth.users(id) on delete set null,
  verification_method text not null default 'none' check (verification_method in (
    'none', 'checklist', 'photo', 'count', 'receipt', 'manager_review',
    'source_state'
  )),
  verification_required boolean not null default false,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  completion_result text,
  completion_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(completion_evidence) = 'array'),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  related_inventory_item_id uuid,
  related_order_id uuid,
  related_recommendation_id uuid,
  related_supplier_name text,
  source_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  client_task_id text not null check (length(trim(client_task_id)) between 1 and 200),
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, client_task_id),
  constraint restaurant_tasks_location_fkey
    foreign key (restaurant_id, location_id)
    references public.pos_locations (restaurant_id, id) on delete set null,
  constraint restaurant_tasks_inventory_fkey
    foreign key (restaurant_id, related_inventory_item_id)
    references public.inventory_items (restaurant_id, id) on delete set null,
  constraint restaurant_tasks_order_fkey
    foreign key (restaurant_id, related_order_id)
    references public.supplier_orders (restaurant_id, id) on delete set null,
  constraint restaurant_tasks_recommendation_fkey
    foreign key (restaurant_id, related_recommendation_id)
    references public.purchase_recommendations (restaurant_id, id) on delete set null,
  constraint restaurant_tasks_window_check
    check (
      (window_start is null and window_end is null)
      or (window_start is not null and window_end is not null and window_end > window_start)
    ),
  constraint restaurant_tasks_custom_window_check
    check (service_window <> 'custom' or window_start is not null),
  constraint restaurant_tasks_verification_check
    check (
      (verification_required and verification_method <> 'none')
      or (not verification_required and verification_method = 'none')
    ),
  constraint restaurant_tasks_completion_check
    check (
      (
        status = 'completed'
        and completed_at is not null
        and completed_by is not null
        and completion_result is not null
        and length(trim(completion_result)) between 1 and 1000
        and (
          not verification_required
          or jsonb_array_length(completion_evidence) > 0
        )
      )
      or (
        status <> 'completed'
        and completed_at is null
        and completed_by is null
        and completion_result is null
        and completion_evidence = '[]'::jsonb
      )
    ),
  constraint restaurant_tasks_checklist_bound_check
    check (jsonb_array_length(checklist) <= 32 and pg_column_size(checklist) <= 32768),
  constraint restaurant_tasks_evidence_bound_check
    check (jsonb_array_length(completion_evidence) <= 32 and pg_column_size(completion_evidence) <= 32768),
  constraint restaurant_tasks_supplier_bound_check
    check (related_supplier_name is null or length(trim(related_supplier_name)) between 1 and 200),
  constraint restaurant_tasks_source_reference_bound_check
    check (source_reference is null or length(trim(source_reference)) between 1 and 240)
);

create table if not exists public.restaurant_task_dependencies (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (restaurant_id, task_id, depends_on_task_id),
  constraint restaurant_task_dependencies_task_fkey
    foreign key (restaurant_id, task_id)
    references public.restaurant_tasks (restaurant_id, id) on delete cascade,
  constraint restaurant_task_dependencies_prerequisite_fkey
    foreign key (restaurant_id, depends_on_task_id)
    references public.restaurant_tasks (restaurant_id, id) on delete restrict,
  constraint restaurant_task_dependencies_no_self_check
    check (task_id <> depends_on_task_id)
);

create index restaurant_tasks_operating_queue_idx
  on public.restaurant_tasks (
    restaurant_id, status, timing_bucket, priority, due_at, created_at
  );
create index restaurant_tasks_assignee_idx
  on public.restaurant_tasks (restaurant_id, assignee_user_id, status)
  where assignee_user_id is not null;
create index restaurant_tasks_service_window_idx
  on public.restaurant_tasks (restaurant_id, service_window, window_start, window_end)
  where service_window is not null;
create index restaurant_task_dependencies_prerequisite_idx
  on public.restaurant_task_dependencies (restaurant_id, depends_on_task_id, task_id);

create trigger set_restaurant_tasks_updated_at
before update on public.restaurant_tasks
for each row execute function public.set_updated_at();

create or replace function private.enforce_restaurant_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = new.restaurant_id
      and membership.user_id = new.assignee_user_id
      and membership.status = 'active'
      and (
        new.required_role = 'member'
        or (new.required_role = 'manager' and membership.role in ('owner', 'admin', 'manager'))
        or (new.required_role = 'owner_admin' and membership.role in ('owner', 'admin'))
      )
  ) then
    raise exception 'Task assignee lacks the required active restaurant role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger enforce_restaurant_task_assignee
before insert or update of restaurant_id, assignee_user_id, required_role
on public.restaurant_tasks
for each row execute function private.enforce_restaurant_task_assignee();

create or replace function private.reject_restaurant_task_dependency_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    with recursive dependency_chain(task_id) as (
      select new.depends_on_task_id
      union
      select dependency.depends_on_task_id
      from public.restaurant_task_dependencies dependency
      join dependency_chain chain
        on chain.task_id = dependency.task_id
      where dependency.restaurant_id = new.restaurant_id
    )
    select 1 from dependency_chain where task_id = new.task_id
  ) then
    raise exception 'Task dependency would create a cycle' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reject_restaurant_task_dependency_cycle
before insert or update of task_id, depends_on_task_id
on public.restaurant_task_dependencies
for each row execute function private.reject_restaurant_task_dependency_cycle();

-- The foundation event vocabulary predates durable restaurant tasks. Extend it
-- without weakening the existing allowed set.
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
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded'
  ));
alter table public.activity_events
  drop constraint if exists activity_events_category_check;
alter table public.activity_events
  add constraint activity_events_category_check check (category in (
    'inventory', 'orders', 'sales', 'team', 'tasks', 'waste', 'approvals',
    'integrations', 'memory', 'system'
  ));

create or replace function private.append_restaurant_task_activity(
  p_task public.restaurant_tasks,
  p_event_type text,
  p_title text,
  p_summary text,
  p_status text,
  p_idempotency_suffix text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.activity_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.activity_events;
begin
  insert into public.activity_events (
    restaurant_id, location_id, event_type, category, title, summary,
    occurred_at, source, actor_type, actor_user_id, trigger_type,
    trigger_reference, evidence_references, source_systems, autonomy_level,
    status, requires_attention, attention_deadline, related_entity_type,
    related_entity_id, sequence_id, correlation_id, idempotency_key, metadata
  ) values (
    p_task.restaurant_id,
    p_task.location_id,
    p_event_type,
    'tasks',
    left(p_title, 160),
    left(p_summary, 1000),
    now(),
    'restaurant_tasks',
    'user',
    auth.uid(),
    p_event_type,
    p_task.id::text,
    coalesce(p_task.completion_evidence, '[]'::jsonb),
    array['mise', 'restaurant_tasks']::text[],
    1,
    p_status,
    p_task.status in ('blocked', 'could_not_verify'),
    p_task.due_at,
    'restaurant_task',
    p_task.id::text,
    format('restaurant_task:%s', p_task.id),
    p_task.correlation_id,
    format('restaurant_task:%s:%s', p_task.id, p_idempotency_suffix),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'origin', p_task.origin,
      'priority', p_task.priority,
      'timingBucket', p_task.timing_bucket,
      'serviceWindow', p_task.service_window,
      'assigneeUserId', p_task.assignee_user_id,
      'verificationMethod', p_task.verification_method
    )
  )
  on conflict (restaurant_id, idempotency_key) do nothing
  returning * into event_row;
  if event_row.id is null then
    select existing.* into event_row
    from public.activity_events existing
    where existing.restaurant_id = p_task.restaurant_id
      and existing.idempotency_key = format(
        'restaurant_task:%s:%s', p_task.id, p_idempotency_suffix
      );
  end if;
  return event_row;
end;
$$;

create or replace function public.create_restaurant_task(
  p_restaurant_id uuid,
  p_client_task_id text,
  p_title text,
  p_detail text default null,
  p_origin text default 'human',
  p_operational_category text default 'other',
  p_priority text default 'normal',
  p_timing_bucket text default 'now',
  p_due_at timestamptz default null,
  p_service_window text default null,
  p_window_start timestamptz default null,
  p_window_end timestamptz default null,
  p_required_role text default 'member',
  p_assignee_user_id uuid default null,
  p_verification_method text default 'none',
  p_checklist jsonb default '[]'::jsonb,
  p_related_inventory_item_id uuid default null,
  p_related_order_id uuid default null,
  p_related_recommendation_id uuid default null,
  p_related_supplier_name text default null,
  p_source_reference text default null,
  p_dependency_ids uuid[] default array[]::uuid[]
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
  dependency_id uuid;
  dependency_count integer;
  existing_dependency_ids uuid[];
  requested_dependency_ids uuid[];
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

  if p_origin not in ('human', 'mise', 'automated', 'approval', 'verification') then
    raise exception 'Invalid task origin' using errcode = '22023';
  end if;
  if actor_role = 'staff' and (
    p_origin <> 'human'
    or p_required_role <> 'member'
    or (p_assignee_user_id is not null and p_assignee_user_id <> actor_user_id)
  ) then
    raise exception 'Staff may create only member-level human tasks for themselves'
      using errcode = '42501';
  end if;

  if nullif(trim(p_client_task_id), '') is null or length(trim(p_client_task_id)) > 200 then
    raise exception 'Client task id is required' using errcode = '22023';
  end if;
  if nullif(trim(p_title), '') is null or length(trim(p_title)) > 160 then
    raise exception 'Task title is required' using errcode = '22023';
  end if;
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'array'
    or jsonb_array_length(p_checklist) > 32 then
    raise exception 'Task checklist must be a bounded array' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_dependency_ids), 0) > 32 then
    raise exception 'Task dependencies exceed the supported limit' using errcode = '22023';
  end if;
  select count(distinct requested.id),
         coalesce(array_agg(distinct requested.id order by requested.id), array[]::uuid[])
    into dependency_count, requested_dependency_ids
  from unnest(coalesce(p_dependency_ids, array[]::uuid[])) requested(id);
  if dependency_count <> coalesce(cardinality(p_dependency_ids), 0) then
    raise exception 'Task dependencies must be unique' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_restaurant_id::text || E'\x1f' || trim(p_client_task_id), 0)
  );

  select existing.* into task_row
  from public.restaurant_tasks existing
  where existing.restaurant_id = p_restaurant_id
    and existing.client_task_id = trim(p_client_task_id);
  if found then
    select coalesce(array_agg(dependency.depends_on_task_id order by dependency.depends_on_task_id), array[]::uuid[])
      into existing_dependency_ids
    from public.restaurant_task_dependencies dependency
    where dependency.restaurant_id = p_restaurant_id
      and dependency.task_id = task_row.id;
    if task_row.created_by is distinct from actor_user_id
      or task_row.title is distinct from trim(p_title)
      or task_row.detail is distinct from nullif(trim(p_detail), '')
      or task_row.origin is distinct from p_origin
      or task_row.operational_category is distinct from p_operational_category
      or task_row.priority is distinct from p_priority
      or task_row.timing_bucket is distinct from p_timing_bucket
      or task_row.due_at is distinct from p_due_at
      or task_row.service_window is distinct from p_service_window
      or task_row.window_start is distinct from p_window_start
      or task_row.window_end is distinct from p_window_end
      or task_row.required_role is distinct from p_required_role
      or task_row.assignee_user_id is distinct from p_assignee_user_id
      or task_row.verification_method is distinct from p_verification_method
      or task_row.checklist is distinct from p_checklist
      or task_row.related_inventory_item_id is distinct from p_related_inventory_item_id
      or task_row.related_order_id is distinct from p_related_order_id
      or task_row.related_recommendation_id is distinct from p_related_recommendation_id
      or task_row.related_supplier_name is distinct from nullif(trim(p_related_supplier_name), '')
      or task_row.source_reference is distinct from nullif(trim(p_source_reference), '')
      or existing_dependency_ids is distinct from requested_dependency_ids
    then
      raise exception 'Client task id already belongs to a different request'
        using errcode = '23505';
    end if;
    return task_row;
  end if;

  select count(distinct dependency.id) into dependency_count
  from unnest(coalesce(p_dependency_ids, array[]::uuid[])) requested(id)
  join public.restaurant_tasks dependency
    on dependency.restaurant_id = p_restaurant_id
   and dependency.id = requested.id;
  if dependency_count <> coalesce(cardinality(p_dependency_ids), 0) then
    raise exception 'Every dependency must be a task in the same restaurant'
      using errcode = '23503';
  end if;

  insert into public.restaurant_tasks (
    restaurant_id, origin, title, detail, operational_category, priority,
    status, timing_bucket, due_at, service_window, window_start, window_end,
    required_role, assignee_user_id, verification_method,
    verification_required, checklist, related_inventory_item_id,
    related_order_id, related_recommendation_id, related_supplier_name,
    source_reference, created_by, client_task_id
  ) values (
    p_restaurant_id,
    p_origin,
    trim(p_title),
    nullif(trim(p_detail), ''),
    p_operational_category,
    p_priority,
    case when coalesce(cardinality(p_dependency_ids), 0) > 0 then 'blocked' else 'waiting' end,
    p_timing_bucket,
    p_due_at,
    p_service_window,
    p_window_start,
    p_window_end,
    p_required_role,
    p_assignee_user_id,
    p_verification_method,
    p_verification_method <> 'none',
    p_checklist,
    p_related_inventory_item_id,
    p_related_order_id,
    p_related_recommendation_id,
    nullif(trim(p_related_supplier_name), ''),
    nullif(trim(p_source_reference), ''),
    actor_user_id,
    trim(p_client_task_id)
  ) returning * into task_row;

  foreach dependency_id in array coalesce(p_dependency_ids, array[]::uuid[])
  loop
    insert into public.restaurant_task_dependencies (
      restaurant_id, task_id, depends_on_task_id, created_by
    ) values (p_restaurant_id, task_row.id, dependency_id, actor_user_id)
    on conflict do nothing;
  end loop;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_created',
    case when task_row.origin = 'mise' then 'Mise prepared a restaurant task' else 'Restaurant task created' end,
    format('%s · %s', task_row.title,
      case when task_row.status = 'blocked' then 'Waiting on prerequisite work.' else 'Ready for the operating plan.' end),
    case when task_row.status = 'blocked' then 'waiting_for_approval' else 'scheduled' end,
    'created',
    jsonb_build_object('dependencyIds', coalesce(p_dependency_ids, array[]::uuid[]))
  );

  return task_row;
end;
$$;

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

create or replace function public.reopen_restaurant_task(
  p_restaurant_id uuid,
  p_task_id uuid
)
returns public.restaurant_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  task_row public.restaurant_tasks;
begin
  if actor_user_id is null or not exists (
    select 1 from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'Manager role required to reopen a task' using errcode = '42501';
  end if;

  select task.* into task_row
  from public.restaurant_tasks task
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  for update;
  if not found then
    raise exception 'Restaurant task not found' using errcode = 'P0002';
  end if;
  if task_row.status <> 'completed' then
    return task_row;
  end if;

  update public.restaurant_tasks task
  set status = case when exists (
        select 1
        from public.restaurant_task_dependencies dependency
        join public.restaurant_tasks prerequisite
          on prerequisite.restaurant_id = dependency.restaurant_id
         and prerequisite.id = dependency.depends_on_task_id
        where dependency.restaurant_id = p_restaurant_id
          and dependency.task_id = p_task_id
          and prerequisite.status <> 'completed'
      ) then 'blocked' else 'waiting' end,
      completion_result = null,
      completion_evidence = '[]'::jsonb,
      completed_at = null,
      completed_by = null
  where task.restaurant_id = p_restaurant_id and task.id = p_task_id
  returning * into task_row;

  perform private.append_restaurant_task_activity(
    task_row,
    'task_reopened',
    'Restaurant task reopened',
    format('%s was reopened for another verified result.', task_row.title),
    'scheduled',
    format('reopened:%s', extract(epoch from task_row.updated_at)::bigint),
    '{}'::jsonb
  );
  return task_row;
end;
$$;

alter table public.restaurant_tasks enable row level security;
alter table public.restaurant_task_dependencies enable row level security;

create policy "Members can view restaurant tasks"
on public.restaurant_tasks for select to authenticated
using (private.is_restaurant_member(restaurant_id));
create policy "Members can view restaurant task dependencies"
on public.restaurant_task_dependencies for select to authenticated
using (private.is_restaurant_member(restaurant_id));

-- Attach the existing operational-mode guard to both new mutable tables.
create trigger enforce_authenticated_operational_mode
before insert or update or delete on public.restaurant_tasks
for each row execute function private.enforce_authenticated_operational_mode();
create trigger enforce_authenticated_operational_mode
before insert or update or delete on public.restaurant_task_dependencies
for each row execute function private.enforce_authenticated_operational_mode();

revoke all on public.restaurant_tasks from public, anon, authenticated, service_role;
revoke all on public.restaurant_task_dependencies from public, anon, authenticated, service_role;
grant select on public.restaurant_tasks to authenticated;
grant select on public.restaurant_task_dependencies to authenticated;
grant select, insert, update, delete on public.restaurant_tasks to service_role;
grant select, insert, update, delete on public.restaurant_task_dependencies to service_role;

revoke all on function private.enforce_restaurant_task_assignee()
  from public, anon, authenticated, service_role;
revoke all on function private.reject_restaurant_task_dependency_cycle()
  from public, anon, authenticated, service_role;
revoke all on function private.append_restaurant_task_activity(
  public.restaurant_tasks, text, text, text, text, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.create_restaurant_task(
  uuid, text, text, text, text, text, text, text, timestamptz, text,
  timestamptz, timestamptz, text, uuid, text, jsonb, uuid, uuid, uuid,
  text, text, uuid[]
) from public, anon, authenticated, service_role;
revoke all on function public.complete_restaurant_task(uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.reopen_restaurant_task(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.create_restaurant_task(
  uuid, text, text, text, text, text, text, text, timestamptz, text,
  timestamptz, timestamptz, text, uuid, text, jsonb, uuid, uuid, uuid,
  text, text, uuid[]
) to authenticated;
grant execute on function public.complete_restaurant_task(uuid, uuid, text, jsonb)
  to authenticated;
grant execute on function public.reopen_restaurant_task(uuid, uuid)
  to authenticated;

comment on table public.restaurant_tasks is
  'Shared, tenant-scoped operating tasks with assignment, windows, verification, and truthful completion results.';
comment on table public.restaurant_task_dependencies is
  'Same-tenant prerequisite edges for restaurant operating tasks; cycles are rejected.';
