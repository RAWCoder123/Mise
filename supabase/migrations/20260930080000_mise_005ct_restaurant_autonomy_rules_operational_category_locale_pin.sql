-- MISE-005CT: pin restaurant_autonomy_rules.operational_category CHECK to
-- COLLATE "C", preserving the exact-token allowlist.
--
-- restaurant_autonomy_rules.operational_category stores autonomy-rule category
-- vocabulary under a bare IN allowlist from operational_backend_foundation:
--   operational_category in (
--     'inventory', 'orders', 'sales', 'team', 'waste', 'tasks',
--     'integrations', 'settings'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'inventory' | 'orders' | 'sales' | 'team' | 'waste' | 'tasks'
--   | 'integrations' | 'settings'
--
-- operational_category gates Autonomy settings grouping and owner/admin rule
-- upsert validation. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pin #503 covers restaurant_tasks.operational_category
-- under a different vocabulary and deliberately left this autonomy-rule
-- column on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN operational_category CHECK,
-- dump/restore could accept autonomy-category bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking Autonomy settings grouping across restore.
--
-- Scope:
--   - Replace restaurant_autonomy_rules_operational_category_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite upsert_restaurant_autonomy_rule, execute_guard,
-- restaurant_tasks.operational_category (#503), free-form action_type /
-- supplier_name / communication_type, or other operational-foundation
-- allowlists (operational_issues / mise_actions / restaurant_memories /
-- activity_events).
-- Timestamp after MISE-005CS (#505).

alter table public.restaurant_autonomy_rules
  drop constraint if exists restaurant_autonomy_rules_operational_category_check;

alter table public.restaurant_autonomy_rules
  add constraint restaurant_autonomy_rules_operational_category_check
  check (
    operational_category in (
      'inventory',
      'orders',
      'sales',
      'team',
      'waste',
      'tasks',
      'integrations',
      'settings'
    )
    and operational_category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_autonomy_rules_operational_category_check
  on public.restaurant_autonomy_rules is
  'MISE-005CT: exact inventory/orders/sales/team/waste/tasks/integrations/settings allowlist plus ASCII shape under COLLATE "C". Autonomy rule category.';

comment on column public.restaurant_autonomy_rules.operational_category is
  'Autonomy rule operational category. Allowed values: inventory, orders, sales, team, waste, tasks, integrations, settings under COLLATE "C".';
