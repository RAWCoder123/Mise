-- MISE-005CR: pin restaurant_tasks.verification_method CHECK to
-- COLLATE "C", preserving the exact-token allowlist.
--
-- restaurant_tasks.verification_method stores completion-evidence vocabulary
-- under a bare IN allowlist from shared_restaurant_tasks:
--   verification_method in (
--     'none', 'checklist', 'photo', 'count', 'receipt', 'manager_review',
--     'source_state'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'none' | 'checklist' | 'photo' | 'count' | 'receipt'
--   | 'manager_review' | 'source_state'
--
-- verification_method gates whether completion evidence is required
-- (paired with restaurant_tasks_verification_check) and how operators prove
-- task completion. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins cover restaurant_tasks.status (#498),
-- origin/required_role (#501), priority/timing_bucket (#502), and
-- operational_category (#503), leaving verification_method on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN verification_method CHECK,
-- dump/restore could accept verification-method bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking evidence requirements and completion consistency across restore.
--
-- Scope:
--   - Replace restaurant_tasks_verification_method_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, status (#498),
-- origin/required_role (#501), priority/timing_bucket (#502),
-- operational_category (#503), client_task_id (#455), service_window,
-- restaurant_tasks_verification_check (required/method pairing),
-- restaurant_tasks_completion_check, or free-form title/detail/
-- completion_result.
-- Timestamp after MISE-005CQ (#503).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_verification_method_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_verification_method_check
  check (
    verification_method in (
      'none',
      'checklist',
      'photo',
      'count',
      'receipt',
      'manager_review',
      'source_state'
    )
    and verification_method collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_verification_method_check
  on public.restaurant_tasks is
  'MISE-005CR: exact none/checklist/photo/count/receipt/manager_review/source_state allowlist plus ASCII shape under COLLATE "C". Shared restaurant task verification method.';

comment on column public.restaurant_tasks.verification_method is
  'Shared restaurant task verification method. Allowed values: none, checklist, photo, count, receipt, manager_review, source_state under COLLATE "C".';
