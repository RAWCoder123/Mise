-- MISE-005CW: pin operational_issues.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- operational_issues.status stores issue-lifecycle vocabulary under a bare
-- IN allowlist from operational_backend_foundation:
--   status in (
--     'open', 'monitoring', 'action_prepared', 'resolved', 'dismissed',
--     'expired'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'open' | 'monitoring' | 'action_prepared' | 'resolved' | 'dismissed'
--   | 'expired'
-- Purchase-recommendation sync maps pending -> action_prepared, else open
-- on insert, and ordered/dismissed/approved to resolved/dismissed/
-- action_prepared on update; 'monitoring' and 'expired' remain reserved
-- allowlisted tokens.
--
-- status gates operational-issue lifecycle on the operator surface and
-- open-issue indexing. POSIX character classes follow database LC_CTYPE.
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; open sibling pin #456 covers operational_issues.dedupe_key
-- under a shape gate and deliberately left category / severity / status on
-- bare IN. Category is covered by open tip #507 (MISE-005CU). Severity is
-- covered by open tip #508 (MISE-005CV).
--
-- If LC_CTYPE drifted under a bare-IN status CHECK, dump/restore could
-- accept issue-status bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking
-- operational-issue lifecycle across restore.
--
-- Scope:
--   - Replace operational_issues_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite the purchase_recommendations sync trigger, category
-- (#507) / severity (#508) allowlists, dedupe_key (#456), mise_actions /
-- restaurant_memories / activity_events allowlists, or
-- restaurant_autonomy_rules.operational_category (#506).
-- Timestamp after MISE-005CV (#508).

alter table public.operational_issues
  drop constraint if exists operational_issues_status_check;

alter table public.operational_issues
  add constraint operational_issues_status_check
  check (
    status in (
      'open',
      'monitoring',
      'action_prepared',
      'resolved',
      'dismissed',
      'expired'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_issues_status_check
  on public.operational_issues is
  'MISE-005CW: exact open/monitoring/action_prepared/resolved/dismissed/expired allowlist plus ASCII shape under COLLATE "C". Operational issue status.';

comment on column public.operational_issues.status is
  'Operational issue status. Allowed values: open, monitoring, action_prepared, resolved, dismissed, expired under COLLATE "C".';
