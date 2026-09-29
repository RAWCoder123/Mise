-- MISE-005CP: pin restaurant_tasks.priority and timing_bucket CHECKs to
-- COLLATE "C", preserving the exact-token allowlists.
--
-- restaurant_tasks.priority and timing_bucket store task urgency and
-- schedule vocabulary under bare IN allowlists from shared_restaurant_tasks:
--   priority in ('urgent', 'high', 'normal', 'low')
--   timing_bucket in ('now', 'up_next', 'later')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   priority:      'urgent' | 'high' | 'normal' | 'low'
--   timing_bucket: 'now' | 'up_next' | 'later'
--
-- priority gates operating-plan urgency ordering and attention ranking.
-- timing_bucket gates Today queue sections (now / up next / later) and
-- schedule presentation. POSIX character classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins cover restaurant_tasks.status (#498) and
-- origin/required_role (#501), leaving priority and timing_bucket on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN priority / timing_bucket CHECK,
-- dump/restore could accept task-schedule bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking urgency and queue placement across restore.
--
-- Scope:
--   - Replace restaurant_tasks_priority_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_tasks_timing_bucket_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, status (#498),
-- origin/required_role (#501), client_task_id (#455), operational_category,
-- verification_method, service_window, completion consistency CHECK, or
-- free-form title/detail/completion_result.
-- Timestamp after MISE-005CO (#501).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_priority_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_priority_check
  check (
    priority in ('urgent', 'high', 'normal', 'low')
    and priority collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_priority_check
  on public.restaurant_tasks is
  'MISE-005CP: exact urgent/high/normal/low allowlist plus ASCII shape under COLLATE "C". Shared restaurant task urgency.';

comment on column public.restaurant_tasks.priority is
  'Shared restaurant task urgency. Allowed values: urgent, high, normal, low under COLLATE "C".';

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_timing_bucket_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_timing_bucket_check
  check (
    timing_bucket in ('now', 'up_next', 'later')
    and timing_bucket collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_timing_bucket_check
  on public.restaurant_tasks is
  'MISE-005CP: exact now/up_next/later allowlist plus ASCII shape under COLLATE "C". Shared restaurant task schedule bucket.';

comment on column public.restaurant_tasks.timing_bucket is
  'Shared restaurant task schedule bucket. Allowed values: now, up_next, later under COLLATE "C".';
