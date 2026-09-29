-- MISE-005CM: pin recalculation_runs.cycle and monitoring_owner CHECKs to
-- COLLATE "C", preserving the exact-token allowlists.
--
-- recalculation_runs.cycle and monitoring_owner store recalculation schedule
-- vocabulary under bare IN allowlists from recalculation_run_ledger:
--   cycle in ('daily_open', 'mid_shift', 'close')
--   monitoring_owner in ('member', 'manager', 'owner_admin')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   cycle:            'daily_open' | 'mid_shift' | 'close'
--   monitoring_owner: 'member' | 'manager' | 'owner_admin'
--
-- cycle identities gate schedule windows, idempotency, failure indexes, and
-- activity routing. monitoring_owner names who must review a dead letter.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open sibling
-- pins cover recalculation_runs keys (#452), job_name (#453), and status
-- (#496), but leave cycle and monitoring_owner on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN cycle / monitoring_owner CHECK,
-- dump/restore could accept schedule-identity bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking recalculation schedule continuity across restore.
--
-- Scope:
--   - Replace recalculation_runs_cycle_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace recalculation_runs_monitoring_owner_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite public.record_recalculation_run, failure consistency
-- CHECK, status (#496), key/job_name pins (#452/#453),
-- inventory_count_sessions.status (#495), restaurant_tasks.status (#498),
-- or free-form failure_reason / cycle_key / idempotency_key.
-- Timestamp after MISE-005CL (#498).

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_cycle_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_cycle_check
  check (
    cycle in ('daily_open', 'mid_shift', 'close')
    and cycle collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recalculation_runs_cycle_check
  on public.recalculation_runs is
  'MISE-005CM: exact daily_open/mid_shift/close allowlist plus ASCII shape under COLLATE "C". Recalculation schedule cycle identity.';

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_monitoring_owner_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_monitoring_owner_check
  check (
    monitoring_owner in ('member', 'manager', 'owner_admin')
    and monitoring_owner collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recalculation_runs_monitoring_owner_check
  on public.recalculation_runs is
  'MISE-005CM: exact member/manager/owner_admin allowlist plus ASCII shape under COLLATE "C". Dead-letter review ownership identity.';

comment on column public.recalculation_runs.cycle is
  'Recalculation schedule cycle. Allowed values: daily_open, mid_shift, close under COLLATE "C".';

comment on column public.recalculation_runs.monitoring_owner is
  'Role accountable for reviewing a dead-lettered cycle. Allowed values: member, manager, owner_admin under COLLATE "C". It does not restrict who may record a run.';
