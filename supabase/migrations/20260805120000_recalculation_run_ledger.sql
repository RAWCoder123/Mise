-- Durable ledger for the Section 26 background recalculation cycles.
--
-- Operational reason: services/domain/recalculationSchedule.ts decides whether the
-- daily_open, mid_shift, and close cycles are due, in backoff, or dead-lettered.
-- That decision is only correct if prior attempts survive across devices and
-- sessions, so the run history must be durable rather than in-memory.
--
-- Security posture: the ledger is append-only tenant data. Members may read it;
-- nobody may INSERT directly. All writes go through public.record_recalculation_run,
-- which derives authority from auth.uid() and an active restaurant membership.
-- Recording a run is a mechanical fact, so any active member may record one --
-- monitoring_owner names who must *review* a dead letter, not who may record it.
-- Gating the write on manager would silently drop rows whenever a line cook opens
-- the app and would strand the schedule in a permanent "due" state.
--
-- Known limitation: Mise has no scheduler and no machine-actor auth path yet, so
-- cycles are dispatched by an authenticated operator session opening the app. A
-- restaurant nobody opens receives no recalculation until someone does.

create table if not exists public.recalculation_runs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cycle text not null check (cycle in ('daily_open', 'mid_shift', 'close')),
  operating_date date not null,
  status text not null check (status in ('succeeded', 'failed')),
  -- Mirrors RECALCULATION_MAX_ATTEMPTS in services/domain/recalculationSchedule.ts.
  attempt smallint not null check (attempt between 1 and 4),
  job_name text not null check (length(trim(job_name)) between 1 and 80),
  monitoring_owner text not null check (monitoring_owner in ('member', 'manager', 'owner_admin')),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms integer not null check (duration_ms between 0 and 3600000),
  timed_out boolean not null default false,
  failure_reason text check (failure_reason is null or length(trim(failure_reason)) between 1 and 200),
  -- Stable per-cycle identity, reused across retries for correlation.
  cycle_key text not null check (length(trim(cycle_key)) between 1 and 240),
  -- Per-attempt replay unit: {cycle_key}:attempt-{n}.
  idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  correlation_id uuid not null default gen_random_uuid(),
  recorded_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, idempotency_key),
  constraint recalculation_runs_failure_check
    check (
      (status = 'failed' and failure_reason is not null)
      or (status = 'succeeded' and failure_reason is null and not timed_out)
    ),
  constraint recalculation_runs_window_check
    check (completed_at >= started_at)
);

create index if not exists recalculation_runs_service_day_idx
  on public.recalculation_runs (restaurant_id, operating_date desc, cycle, attempt desc);

create index if not exists recalculation_runs_failure_idx
  on public.recalculation_runs (restaurant_id, operating_date desc, cycle)
  where status = 'failed';

create or replace function public.record_recalculation_run(
  p_restaurant_id uuid,
  p_cycle text,
  p_operating_date date,
  p_status text,
  p_attempt smallint,
  p_job_name text,
  p_monitoring_owner text,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_ms integer,
  p_timed_out boolean,
  p_failure_reason text,
  p_cycle_key text,
  p_idempotency_key text
)
returns public.recalculation_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_role text;
  existing_run public.recalculation_runs;
  inserted_run public.recalculation_runs;
  normalized_reason text := nullif(trim(coalesce(p_failure_reason, '')), '');
  normalized_cycle_key text := trim(coalesce(p_cycle_key, ''));
  normalized_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  normalized_job_name text := trim(coalesce(p_job_name, ''));
  normalized_timed_out boolean := coalesce(p_timed_out, false);
begin
  if actor_user_id is null then
    raise exception 'Recalculation run recording requires an authenticated actor'
      using errcode = '42501';
  end if;

  select membership.role into actor_role
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.user_id = actor_user_id
    and membership.status = 'active';

  if actor_role is null then
    raise exception 'Recalculation run access denied' using errcode = '42501';
  end if;

  if p_operating_date is null
    or p_started_at is null
    or p_completed_at is null
    or p_completed_at < p_started_at
    or p_cycle is null or p_cycle not in ('daily_open', 'mid_shift', 'close')
    or p_status is null or p_status not in ('succeeded', 'failed')
    or p_monitoring_owner is null
      or p_monitoring_owner not in ('member', 'manager', 'owner_admin')
    or p_attempt is null or p_attempt < 1 or p_attempt > 4
    or p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 3600000
    or normalized_job_name = '' or length(normalized_job_name) > 80
    or normalized_cycle_key = '' or length(normalized_cycle_key) > 240
    or normalized_idempotency_key = '' or length(normalized_idempotency_key) > 240
    or (normalized_reason is not null and length(normalized_reason) > 200)
    or (p_status = 'failed' and normalized_reason is null)
    or (p_status = 'succeeded' and (normalized_reason is not null or normalized_timed_out))
  then
    raise exception 'Recalculation run evidence is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || normalized_idempotency_key,
      0
    )
  );

  select * into existing_run
  from public.recalculation_runs
  where restaurant_id = p_restaurant_id
    and idempotency_key = normalized_idempotency_key;

  if found then
    -- An identical replay is the same fact recorded twice; anything else is a
    -- different attempt wearing a used key.
    if existing_run.cycle is distinct from p_cycle
      or existing_run.operating_date is distinct from p_operating_date
      or existing_run.status is distinct from p_status
      or existing_run.attempt is distinct from p_attempt
      or existing_run.job_name is distinct from normalized_job_name
      or existing_run.monitoring_owner is distinct from p_monitoring_owner
      or existing_run.duration_ms is distinct from p_duration_ms
      or existing_run.timed_out is distinct from normalized_timed_out
      or existing_run.failure_reason is distinct from normalized_reason
      or existing_run.cycle_key is distinct from normalized_cycle_key
    then
      raise exception 'Recalculation run idempotency key already recorded a different attempt'
        using errcode = '23505';
    end if;
    return existing_run;
  end if;

  insert into public.recalculation_runs (
    restaurant_id, cycle, operating_date, status, attempt, job_name,
    monitoring_owner, started_at, completed_at, duration_ms, timed_out,
    failure_reason, cycle_key, idempotency_key, recorded_by
  ) values (
    p_restaurant_id, p_cycle, p_operating_date, p_status, p_attempt,
    normalized_job_name, p_monitoring_owner, p_started_at, p_completed_at,
    p_duration_ms, normalized_timed_out, normalized_reason,
    normalized_cycle_key, normalized_idempotency_key, actor_user_id
  )
  returning * into inserted_run;

  return inserted_run;
end;
$$;

-- Activity emission is deliberately sparing: the ledger is the job log, while
-- activity_events is the operator feed. One success beat per service day, and
-- every failure -- but only the dead-lettered attempt demands a human.
create or replace function private.capture_recalculation_run_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type text;
  event_category text;
  event_title text;
  event_summary text;
  event_status text;
  event_attention boolean;
  event_error_code text;
begin
  if new.status = 'succeeded' then
    -- mid_shift and close successes stay in the ledger only.
    if new.cycle <> 'daily_open' then
      return new;
    end if;
    event_type := 'forecast_updated';
    event_category := 'inventory';
    event_title := 'Opening recalculation completed';
    event_summary := 'Mise refreshed forecasts, recommendations, and insights for the operating day.';
    event_status := 'completed';
    event_attention := false;
    event_error_code := null;
  else
    event_type := 'automation_failed';
    event_category := 'system';
    event_title := 'Scheduled recalculation failed';
    event_summary := format(
      'Attempt %s of the %s recalculation did not complete. %s',
      new.attempt,
      replace(new.cycle, '_', ' '),
      coalesce(new.failure_reason, 'No failure reason was recorded.')
    );
    event_status := 'failed';
    -- Only a dead letter (attempts exhausted) requires a human.
    event_attention := new.attempt >= 4;
    event_error_code := case when new.timed_out
      then 'recalculation_timed_out'
      else 'recalculation_failed'
    end;
  end if;

  perform private.append_activity_event(
    new.restaurant_id, event_type, event_category, event_title, event_summary,
    new.completed_at, 'recalculation', 'mise', new.recorded_by,
    'recalculation', new.id::text,
    jsonb_build_array(jsonb_build_object(
      'type', 'recalculation_run',
      'id', new.id,
      'summary', format('%s attempt %s recorded %s.', new.job_name, new.attempt, new.status),
      'observedAt', new.completed_at
    )),
    array['mise']::text[],
    null, null, 4::smallint, null,
    event_status, event_attention, null, 'recalculation_run',
    new.id::text,
    format('recalculation:%s:%s', new.operating_date, new.cycle),
    new.correlation_id, null,
    format('recalculation_run:%s', new.id),
    jsonb_build_object(
      'cycle', new.cycle,
      'attempt', new.attempt,
      'maxAttempts', 4,
      'monitoringOwner', new.monitoring_owner,
      'jobName', new.job_name,
      'durationMs', new.duration_ms,
      'timedOut', new.timed_out,
      'cycleKey', new.cycle_key
    ),
    event_error_code, new.failure_reason, null
  );
  return new;
end;
$$;

drop trigger if exists capture_recalculation_run_activity on public.recalculation_runs;
create trigger capture_recalculation_run_activity
after insert on public.recalculation_runs
for each row execute function private.capture_recalculation_run_activity();

drop trigger if exists enforce_authenticated_operational_mode on public.recalculation_runs;
create trigger enforce_authenticated_operational_mode
before insert or update or delete on public.recalculation_runs
for each row execute function private.enforce_authenticated_operational_mode();

drop trigger if exists reject_recalculation_run_mutation on public.recalculation_runs;
create trigger reject_recalculation_run_mutation
before update or delete on public.recalculation_runs
for each row execute function private.reject_immutable_operational_record_mutation();

alter table public.recalculation_runs enable row level security;

drop policy if exists "Members can view recalculation runs" on public.recalculation_runs;
create policy "Members can view recalculation runs"
on public.recalculation_runs
for select
to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on public.recalculation_runs from public, anon, authenticated, service_role;
grant select on public.recalculation_runs to authenticated;
grant select, insert on public.recalculation_runs to service_role;

revoke all on function public.record_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) to authenticated;

revoke all on function private.capture_recalculation_run_activity()
  from public, anon, authenticated, service_role;

comment on table public.recalculation_runs is
  'Append-only ledger of scheduled recalculation attempts so retry, backoff, and dead-letter decisions survive across devices and sessions.';
comment on column public.recalculation_runs.cycle_key is
  'Stable per-cycle identity reused across retries so attempts of one cycle correlate.';
comment on column public.recalculation_runs.idempotency_key is
  'Per-attempt replay unit; an identical replay returns the original row and a different payload is rejected.';
comment on column public.recalculation_runs.monitoring_owner is
  'Role accountable for reviewing a dead-lettered cycle. It does not restrict who may record a run.';
comment on function public.record_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) is
  'Records one finished recalculation attempt for an active member of the restaurant, idempotent on the per-attempt key.';
comment on function private.capture_recalculation_run_activity() is
  'Projects recalculation failures, and the opening success beat, into the operator activity feed.';
