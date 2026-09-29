-- MISE-005CU: pin operational_issues.category CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- operational_issues.category stores issue-category vocabulary under a bare
-- IN allowlist from operational_backend_foundation:
--   category in (
--     'inventory', 'orders', 'sales', 'team', 'waste', 'integrations',
--     'tasks', 'system'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'inventory' | 'orders' | 'sales' | 'team' | 'waste' | 'integrations'
--   | 'tasks' | 'system'
--
-- category gates operational-issue grouping on the operator surface and
-- purchase-recommendation sync inserts ('inventory' today). POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pin #456 covers
-- operational_issues.dedupe_key under a shape gate and deliberately left
-- category / severity / status on bare IN.
--
-- If LC_CTYPE drifted under a bare-IN category CHECK, dump/restore could
-- accept issue-category bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking
-- operational-issue grouping across restore.
--
-- Scope:
--   - Replace operational_issues_category_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite the purchase_recommendations sync trigger, severity /
-- status allowlists, dedupe_key (#456), mise_actions / restaurant_memories /
-- activity_events allowlists, or restaurant_autonomy_rules.operational_category
-- (#506).
-- Timestamp after MISE-005CT (#506).

alter table public.operational_issues
  drop constraint if exists operational_issues_category_check;

alter table public.operational_issues
  add constraint operational_issues_category_check
  check (
    category in (
      'inventory',
      'orders',
      'sales',
      'team',
      'waste',
      'integrations',
      'tasks',
      'system'
    )
    and category collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_issues_category_check
  on public.operational_issues is
  'MISE-005CU: exact inventory/orders/sales/team/waste/integrations/tasks/system allowlist plus ASCII shape under COLLATE "C". Operational issue category.';

comment on column public.operational_issues.category is
  'Operational issue category. Allowed values: inventory, orders, sales, team, waste, integrations, tasks, system under COLLATE "C".';
