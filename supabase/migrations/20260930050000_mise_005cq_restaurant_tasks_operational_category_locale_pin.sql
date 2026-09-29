-- MISE-005CQ: pin restaurant_tasks.operational_category CHECK to
-- COLLATE "C", preserving the exact-token allowlist.
--
-- restaurant_tasks.operational_category stores task category vocabulary
-- under a bare IN allowlist from shared_restaurant_tasks:
--   operational_category in (
--     'inventory', 'orders', 'prep', 'service', 'team', 'cleaning',
--     'maintenance', 'deliveries', 'closing', 'integrations', 'other'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'inventory' | 'orders' | 'prep' | 'service' | 'team' | 'cleaning'
--   | 'maintenance' | 'deliveries' | 'closing' | 'integrations' | 'other'
--
-- operational_category gates operating-plan grouping, Today filters, and
-- autonomy category alignment for shared tasks. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; open sibling pins cover
-- restaurant_tasks.status (#498), origin/required_role (#501), and
-- priority/timing_bucket (#502), leaving operational_category on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN operational_category CHECK,
-- dump/restore could accept task-category bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking category grouping and filters across restore.
--
-- Scope:
--   - Replace restaurant_tasks_operational_category_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite create/complete/reopen task RPCs, status (#498),
-- origin/required_role (#501), priority/timing_bucket (#502),
-- client_task_id (#455), verification_method, service_window, completion
-- consistency CHECK, autonomy_configuration.operational_category, or
-- free-form title/detail/completion_result.
-- Timestamp after MISE-005CP (#502).

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_operational_category_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_operational_category_check
  check (
    operational_category in (
      'inventory',
      'orders',
      'prep',
      'service',
      'team',
      'cleaning',
      'maintenance',
      'deliveries',
      'closing',
      'integrations',
      'other'
    )
    and operational_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_tasks_operational_category_check
  on public.restaurant_tasks is
  'MISE-005CQ: exact inventory/orders/prep/service/team/cleaning/maintenance/deliveries/closing/integrations/other allowlist plus ASCII shape under COLLATE "C". Shared restaurant task category.';

comment on column public.restaurant_tasks.operational_category is
  'Shared restaurant task category. Allowed values: inventory, orders, prep, service, team, cleaning, maintenance, deliveries, closing, integrations, other under COLLATE "C".';
