-- MISE-005CV: pin operational_issues.severity CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- operational_issues.severity stores issue-severity vocabulary under a bare
-- IN allowlist from operational_backend_foundation:
--   severity in ('info', 'watch', 'warning', 'critical')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'info' | 'watch' | 'warning' | 'critical'
-- Purchase-recommendation sync maps urgency high/medium/else to
-- critical/warning/watch today; 'info' remains a reserved allowlisted token.
--
-- severity gates operational-issue prioritization on the operator surface.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open sibling
-- pin #456 covers operational_issues.dedupe_key under a shape gate and
-- deliberately left category / severity / status on bare IN. Category is
-- covered by open tip #507 (MISE-005CU).
--
-- If LC_CTYPE drifted under a bare-IN severity CHECK, dump/restore could
-- accept issue-severity bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking
-- operational-issue prioritization across restore.
--
-- Scope:
--   - Replace operational_issues_severity_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite the purchase_recommendations sync trigger, category /
-- status allowlists, dedupe_key (#456), mise_actions / restaurant_memories /
-- activity_events allowlists, or restaurant_autonomy_rules.operational_category
-- (#506).
-- Timestamp after MISE-005CU (#507).

alter table public.operational_issues
  drop constraint if exists operational_issues_severity_check;

alter table public.operational_issues
  add constraint operational_issues_severity_check
  check (
    severity in (
      'info',
      'watch',
      'warning',
      'critical'
    )
    and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_issues_severity_check
  on public.operational_issues is
  'MISE-005CV: exact info/watch/warning/critical allowlist plus ASCII shape under COLLATE "C". Operational issue severity.';

comment on column public.operational_issues.severity is
  'Operational issue severity. Allowed values: info, watch, warning, critical under COLLATE "C".';
