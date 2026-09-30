-- MISE-005DI: pin public.ai_insights.risk_level CHECK to COLLATE "C",
-- preserving the exact-token allowlist low/medium/high.
--
-- ai_insights.risk_level stores AI insight severity vocabulary under a
-- bare IN allowlist from restaurant_ops_backbone:
--   risk_level in ('low', 'medium', 'high')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'low'    — low operational risk
--   'medium' — elevated risk requiring attention
--   'high'   — high risk requiring prompt action
--
-- ai_insights.risk_level gates structured insight presentation and
-- operator triage. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins #520 (status), #483 (provenance), and #479
-- (schema_version) leave risk_level on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN ai_insights.risk_level CHECK,
-- dump/restore could accept insight severity bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking AI insight continuity across restore.
--
-- Scope:
--   - Replace ai_insights_risk_level_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite private.service_create_rules_engine_ai_insight,
-- ai_insights status (#520), provenance (#483), schema_version (#479),
-- output bounds, or other bare-IN vocabularies.
-- Timestamp after MISE-005DH (#520).

alter table public.ai_insights
  drop constraint if exists ai_insights_risk_level_check;

alter table public.ai_insights
  add constraint ai_insights_risk_level_check
  check (
    risk_level in ('low', 'medium', 'high')
    and risk_level collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ai_insights_risk_level_check
  on public.ai_insights is
  'MISE-005DI: exact low/medium/high allowlist plus ASCII shape under COLLATE "C". AI insight risk severity.';

comment on column public.ai_insights.risk_level is
  'AI insight risk severity. Allowed values: low, medium, high under COLLATE "C".';
