-- MISE-005DC: pin public.insights.insight_type and severity CHECKs
-- to COLLATE "C", preserving the exact-token allowlists.
--
-- public.insights stores operational insight vocabulary under bare IN
-- allowlists from secure_multi_tenant_rls:
--   insight_type in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
--   severity in ('info', 'warning', 'urgent')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   insight_type:
--     'sales'     — sales-mix / demand guidance
--     'inventory' — stock health and stockout risk
--     'waste'     — spoilage and waste risk
--     'cost'      — food-cost / spend guidance
--     'prep'      — prep and service readiness
--     'ordering'  — purchasing and reorder guidance
--   severity:
--     'info'      — informational / low urgency
--     'warning'   — needs attention soon
--     'urgent'    — needs attention now
--
-- insight_type and severity gate insight commit validation, Today/ops
-- presentation priority, finding routing, and revision-gated guidance
-- visibility. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pin #485 covers insights.generation_source, and
-- #508 covers operational_issues.severity, but leave insights.insight_type
-- and insights.severity on bare IN only.
--
-- If LC_CTYPE drifted under bare-IN insight_type/severity CHECKs,
-- dump/restore could accept insight-vocabulary bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking insight continuity across restore.
--
-- Scope:
--   - Replace insights_insight_type_check and insights_severity_check with
--     exact-token allowlists PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite insight commit writers, generation_source (#485),
-- planning_revision, ai_insights provenance (#483), operational_issues
-- severity (#508), or free-form insight body text.
-- Timestamp after MISE-005DB (#514).

alter table public.insights
  drop constraint if exists insights_insight_type_check;

alter table public.insights
  add constraint insights_insight_type_check
  check (
    insight_type in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
    and insight_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

alter table public.insights
  drop constraint if exists insights_severity_check;

alter table public.insights
  add constraint insights_severity_check
  check (
    severity in ('info', 'warning', 'urgent')
    and severity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint insights_insight_type_check
  on public.insights is
  'MISE-005DC: exact sales/inventory/waste/cost/prep/ordering allowlist plus ASCII shape under COLLATE "C". Operational insight category.';

comment on constraint insights_severity_check
  on public.insights is
  'MISE-005DC: exact info/warning/urgent allowlist plus ASCII shape under COLLATE "C". Operational insight severity.';

comment on column public.insights.insight_type is
  'Operational insight category. Allowed values: sales, inventory, waste, cost, prep, ordering under COLLATE "C".';

comment on column public.insights.severity is
  'Operational insight severity. Allowed values: info, warning, urgent under COLLATE "C".';
