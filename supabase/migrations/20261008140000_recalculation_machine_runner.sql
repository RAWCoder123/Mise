-- Authorized machine runner for Section 26 recalculation cycles.
--
-- Operational reason: the run ledger and schedule brain already exist, but cycles
-- only ran when an authenticated operator opened the app. Restaurants that nobody
-- opened received no opening/mid-shift/close refresh. This migration adds a
-- service-role recording path and target/actor helpers so an Edge Function that
-- authenticates with a dedicated runner secret can dispatch due cycles without a
-- human session, while signal refresh still uses an existing manager-class member
-- through the mature actor-bound planning RPCs.
--
-- Security posture:
-- - public.record_recalculation_run remains authenticated-member only.
-- - Machine writes go through public.service_record_machine_recalculation_run,
--   which is executable only by service_role and never by anon/authenticated.
-- - Machine rows set recorded_source = 'machine' and recorded_by = null so the
--   ledger never invents a human actor for an unattended run.
-- - Signal fetch/commit stay actor-bound; the runner resolves an active
--   owner/admin/manager and fails closed when none exists.
-- - System read_only/emergency mode returns no targets and refuses machine writes
--   inside the service RPC (the pause trigger skips when auth.uid() is null).

alter table public.recalculation_runs
  add column if not exists recorded_source text not null default 'member';

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_recorded_source_check;
alter table public.recalculation_runs
  add constraint recalculation_runs_recorded_source_check
  check (recorded_source in ('member', 'machine'));

alter table public.recalculation_runs
  alter column recorded_by drop not null;

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_recorded_actor_check;
alter table public.recalculation_runs
  add constraint recalculation_runs_recorded_actor_check
  check (
    (recorded_source = 'member' and recorded_by is not null)
    or (recorded_source = 'machine' and recorded_by is null)
  );

comment on column public.recalculation_runs.recorded_source is
  'Whether an authenticated member session or the authorized machine runner recorded the attempt.';

comment on table public.recalculation_runs is
  'Append-only ledger of scheduled recalculation attempts so retry, backoff, and dead-letter decisions survive across devices and sessions. Member sessions and the secret-authenticated machine runner may both record attempts.';

create or replace function private.system_operational_mode_blocks_writes()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.system_operational_controls controls
    where controls.singleton
      and controls.operational_mode in ('read_only', 'emergency')
  );
$$;

revoke all on function private.system_operational_mode_blocks_writes()
  from public, anon, authenticated, service_role;
grant execute on function private.system_operational_mode_blocks_writes() to service_role;

create or replace function public.service_list_recalculation_runner_targets(
  p_limit integer default 25
)
returns table (
  restaurant_id uuid,
  timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_limit integer := coalesce(p_limit, 25);
begin
  if safe_limit < 1 or safe_limit > 100 then
    raise exception 'Recalculation runner target limit is outside supported bounds'
      using errcode = '22023';
  end if;

  if private.system_operational_mode_blocks_writes() then
    return;
  end if;

  return query
  select restaurant.id, restaurant.timezone
  from public.restaurants restaurant
  where nullif(btrim(coalesce(restaurant.timezone, '')), '') is not null
    and exists (
      select 1
      from public.restaurant_memberships membership
      where membership.restaurant_id = restaurant.id
        and membership.status = 'active'
    )
  order by restaurant.id
  limit safe_limit;
end;
$$;

create or replace function public.service_resolve_recalculation_signal_actor(
  p_restaurant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid;
begin
  if p_restaurant_id is null then
    raise exception 'Recalculation signal actor resolution requires a restaurant'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.restaurants restaurant where restaurant.id = p_restaurant_id
  ) then
    raise exception 'Recalculation signal actor restaurant was not found'
      using errcode = '42501';
  end if;

  select membership.user_id
  into actor_user_id
  from public.restaurant_memberships membership
  where membership.restaurant_id = p_restaurant_id
    and membership.status = 'active'
    and membership.role in ('owner', 'admin', 'manager')
  order by
    case membership.role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    membership.created_at,
    membership.user_id
  limit 1;

  return actor_user_id;
end;
$$;

create or replace function public.service_record_machine_recalculation_run(
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
  existing_run public.recalculation_runs;
  inserted_run public.recalculation_runs;
  normalized_reason text := nullif(btrim(coalesce(p_failure_reason, '')), '');
  normalized_cycle_key text := btrim(coalesce(p_cycle_key, ''));
  normalized_idempotency_key text := btrim(coalesce(p_idempotency_key, ''));
  normalized_job_name text := btrim(coalesce(p_job_name, ''));
  normalized_timed_out boolean := coalesce(p_timed_out, false);
begin
  if private.system_operational_mode_blocks_writes() then
    raise exception using
      errcode = '55000',
      message = 'Mise is temporarily read-only. Tenant changes are paused.';
  end if;

  if not exists (
    select 1 from public.restaurants restaurant where restaurant.id = p_restaurant_id
  ) then
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
      or existing_run.recorded_source is distinct from 'machine'
    then
      raise exception 'Recalculation run idempotency key already recorded a different attempt'
        using errcode = '23505';
    end if;
    return existing_run;
  end if;

  insert into public.recalculation_runs (
    restaurant_id, cycle, operating_date, status, attempt, job_name,
    monitoring_owner, started_at, completed_at, duration_ms, timed_out,
    failure_reason, cycle_key, idempotency_key, recorded_by, recorded_source
  ) values (
    p_restaurant_id, p_cycle, p_operating_date, p_status, p_attempt,
    normalized_job_name, p_monitoring_owner, p_started_at, p_completed_at,
    p_duration_ms, normalized_timed_out, normalized_reason,
    normalized_cycle_key, normalized_idempotency_key, null, 'machine'
  )
  returning * into inserted_run;

  return inserted_run;
end;
$$;

revoke all on function public.service_list_recalculation_runner_targets(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.service_resolve_recalculation_signal_actor(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.service_record_machine_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.service_list_recalculation_runner_targets(integer)
  to service_role;
grant execute on function public.service_resolve_recalculation_signal_actor(uuid)
  to service_role;
grant execute on function public.service_record_machine_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) to service_role;

comment on function public.service_list_recalculation_runner_targets(integer) is
  'Service-role listing of restaurants eligible for unattended recalculation dispatch. Empty while Mise is read-only or in emergency mode.';
comment on function public.service_resolve_recalculation_signal_actor(uuid) is
  'Resolves an active owner/admin/manager who can authorize actor-bound signal refresh for a machine-dispatched recalculation.';
comment on function public.service_record_machine_recalculation_run(
  uuid, text, date, text, smallint, text, text, timestamptz, timestamptz,
  integer, boolean, text, text, text
) is
  'Records one finished recalculation attempt for the authorized machine runner. Never invents a human recorded_by.';
