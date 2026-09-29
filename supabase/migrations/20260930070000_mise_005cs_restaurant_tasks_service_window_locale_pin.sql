-- MISE-005CS: pin restaurant_tasks.service_window CHECK to
-- COLLATE "C", preserving the nullable exact-token allowlist.
--
-- restaurant_tasks.service_window stores optional service-timing vocabulary
-- under a bare nullable IN allowlist from shared_restaurant_tasks:
--   service_window is null or service_window in (
--     'before_lunch', 'before_prep', 'before_supplier_cutoff',
--     'before_dinner_service', 'during_closing', 'end_of_day', 'custom'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'before_lunch' | 'before_prep' | 'before_supplier_cutoff'
--   | 'before_dinner_service' | 'during_closing' | 'end_of_day' | 'custom'
--   or NULL when no service window applies.
--
-- service_window gates operating-plan timing and pairs with
-- restaurant_tasks_custom_window_check / restaurant_tasks_window_check for
-- custom window bounds. POSIX character classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins cover restaurant_tasks.status (#498),
-- origin/required_role (#501), priority/timing_bucket (#502),
-- operational_category (#503), and verification_method (#504), leaving
-- service_window on bare nullable IN.
--
-- If LC_CTYPE drifted under a bare-IN service_window CHECK, dump/restore
-- could accept service-window bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking
-- operating-plan timing across restore.
--
-- Scope:
--   - Replace restaurant_tasks_service_window_check with nullable
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, status (#498),
-- origin/required_role (#501), priority/timing_bucket (#502),
-- operational_category (#503), verification_method (#504),
-- client_task_id (#455), restaurant_tasks_custom_window_check,
-- restaurant_tasks_window_check, restaurant_tasks_verification_check,
-- restaurant_tasks_completion_check, or free-form title/detail/
-- completion_result.
-- Timestamp after MISE-005CR (#504).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_service_window_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_service_window_check
  check (
    service_window is null
    or (
      service_window in (
        'before_lunch',
        'before_prep',
        'before_supplier_cutoff',
        'before_dinner_service',
        'during_closing',
        'end_of_day',
        'custom'
      )
      and service_window collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
    )
  );

comment on constraint restaurant_tasks_service_window_check
  on public.restaurant_tasks is
  'MISE-005CS: nullable exact before_lunch/before_prep/before_supplier_cutoff/before_dinner_service/during_closing/end_of_day/custom allowlist plus ASCII shape under COLLATE "C". Shared restaurant task service window.';

comment on column public.restaurant_tasks.service_window is
  'Optional shared restaurant task service window. Allowed values: before_lunch, before_prep, before_supplier_cutoff, before_dinner_service, during_closing, end_of_day, custom under COLLATE "C", or null.';
