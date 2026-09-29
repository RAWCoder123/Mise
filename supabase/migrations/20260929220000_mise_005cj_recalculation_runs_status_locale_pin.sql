-- MISE-005CJ: pin recalculation_runs.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist succeeded/failed.
--
-- recalculation_runs.status stores recalculation outcome vocabulary under a
-- bare IN allowlist from recalculation_run_ledger:
--   status in ('succeeded', 'failed')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'succeeded' — cycle completed without failure_reason / timeout
--   'failed'    — cycle failed or timed out; failure_reason required
--
-- recalculation_runs.status gates the failure consistency CHECK, the
-- failure-partial index, schedule idempotency (succeeded ends the day),
-- and activity routing (automation_failed vs success). POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pins cover
-- recalculation_runs keys (#452) and job_name (#453), and
-- inventory_count_sessions.status (#495), but leave
-- recalculation_runs.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN recalculation_runs.status CHECK,
-- dump/restore could accept outcome-state bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the
-- reverse — breaking recalculation schedule continuity across restore.
--
-- Scope:
--   - Replace recalculation_runs_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite public.record_recalculation_run, failure consistency
-- CHECK, cycle/monitoring_owner allowlists, key/job_name pins (#452/#453),
-- inventory_count_sessions.status (#495), or free-form failure_reason.
-- Timestamp after MISE-005CI (#495).

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_status_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_status_check
  check (
    status in ('succeeded', 'failed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recalculation_runs_status_check
  on public.recalculation_runs is
  'MISE-005CJ: exact succeeded/failed allowlist plus ASCII shape under COLLATE "C". Recalculation run outcome state.';

comment on column public.recalculation_runs.status is
  'Recalculation run outcome. Allowed values: succeeded, failed under COLLATE "C".';
