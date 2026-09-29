-- MISE-005CL: pin restaurant_tasks.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist waiting/blocked/in_progress/
-- completed/cancelled/could_not_verify.
--
-- restaurant_tasks.status stores shared-task lifecycle vocabulary under a
-- bare IN allowlist from shared_restaurant_tasks:
--   status in (
--     'waiting', 'blocked', 'in_progress', 'completed', 'cancelled',
--     'could_not_verify'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'waiting'          — open task ready for work
--   'blocked'          — waiting on a prerequisite or gate
--   'in_progress'      — actively being worked
--   'completed'        — verified completion recorded
--   'cancelled'        — intentionally withdrawn
--   'could_not_verify' — completion attempted but evidence failed
--
-- restaurant_tasks.status gates the completion consistency CHECK, open-queue
-- indexes, dependency unblocking, operating-plan presentation, and
-- activity routing. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins cover supplier_orders.status (#497) and
-- recalculation_runs.status (#496), but leave restaurant_tasks.status on
-- bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN restaurant_tasks.status CHECK,
-- dump/restore could accept task-lifecycle bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the
-- reverse — breaking task queue continuity across restore.
--
-- Scope:
--   - Replace restaurant_tasks_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, the completion
-- consistency CHECK, dependency helpers, client_task_id pin (#455),
-- supplier_orders.status (#497), recalculation_runs.status (#496),
-- inventory_count_sessions.status (#495), or free-form title/detail/
-- completion_result.
-- Timestamp after MISE-005CK (#497).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_status_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_status_check
  check (
    status in (
      'waiting',
      'blocked',
      'in_progress',
      'completed',
      'cancelled',
      'could_not_verify'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_status_check
  on public.restaurant_tasks is
  'MISE-005CL: exact waiting/blocked/in_progress/completed/cancelled/could_not_verify allowlist plus ASCII shape under COLLATE "C". Shared restaurant task lifecycle state.';

comment on column public.restaurant_tasks.status is
  'Shared restaurant task lifecycle. Allowed values: waiting, blocked, in_progress, completed, cancelled, could_not_verify under COLLATE "C".';
