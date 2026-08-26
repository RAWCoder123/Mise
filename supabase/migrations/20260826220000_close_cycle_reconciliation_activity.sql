-- Close-cycle reconciliation activity projection.
-- Open still emits the morning success beat; mid_shift stays ledger-only;
-- close now emits a reconciliation success beat so owners see waste / variance /
-- stock carryover work finished. Failures and dead letters are unchanged.

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
    -- mid_shift successes stay in the ledger only.
    if new.cycle = 'mid_shift' then
      return new;
    end if;
    if new.cycle <> 'daily_open' and new.cycle <> 'close' then
      return new;
    end if;
    event_type := 'forecast_updated';
    event_category := 'inventory';
    if new.cycle = 'close' then
      event_title := 'Closing reconciliation completed';
      event_summary := 'Mise reconciled waste, count variance, and carryover stock risk for the operating day, then refreshed tomorrow''s planning signals.';
    else
      event_title := 'Opening recalculation completed';
      event_summary := 'Mise refreshed forecasts, recommendations, and insights for the operating day.';
    end if;
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

comment on function private.capture_recalculation_run_activity() is
  'Projects opening success, closing reconciliation success, and recalculation failures into the operator activity feed.';
