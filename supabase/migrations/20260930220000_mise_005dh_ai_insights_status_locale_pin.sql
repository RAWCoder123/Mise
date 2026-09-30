-- MISE-005DH: pin public.ai_insights.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist generated/reviewed/dismissed/applied.
--
-- ai_insights.status stores AI insight lifecycle vocabulary under a
-- bare IN allowlist from restaurant_ops_backbone:
--   status in ('generated', 'reviewed', 'dismissed', 'applied')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'generated' — newly minted insight awaiting operator review
--   'reviewed'  — operator reviewed the insight without applying
--   'dismissed' — operator dismissed the insight
--   'applied'   — operator applied the recommended action
--
-- ai_insights.status gates demo/export reads and structured insight
-- presentation. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins #483 (provenance) and #479 (schema_version)
-- leave status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN ai_insights.status CHECK,
-- dump/restore could accept insight lifecycle bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking AI insight continuity across restore.
--
-- Scope:
--   - Replace ai_insights_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite private.service_create_rules_engine_ai_insight,
-- ai_insights provenance (#483), schema_version (#479), risk_level,
-- output bounds, or other bare-IN vocabularies.
-- Timestamp after MISE-005DG (#519).

alter table public.ai_insights
  drop constraint if exists ai_insights_status_check;

alter table public.ai_insights
  add constraint ai_insights_status_check
  check (
    status in ('generated', 'reviewed', 'dismissed', 'applied')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ai_insights_status_check
  on public.ai_insights is
  'MISE-005DH: exact generated/reviewed/dismissed/applied allowlist plus ASCII shape under COLLATE "C". AI insight lifecycle state.';

comment on column public.ai_insights.status is
  'AI insight lifecycle. Allowed values: generated, reviewed, dismissed, applied under COLLATE "C".';
