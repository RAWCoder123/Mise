-- MISE-005DJ: pin public.ai_insights.source CHECK to COLLATE "C",
-- preserving the exact-token allowlist
-- openai_structured_output / rules_engine / operator_note.
--
-- ai_insights.source stores AI insight generation-source vocabulary under a
-- bare IN allowlist from restaurant_ops_backbone:
--   source in ('openai_structured_output', 'rules_engine', 'operator_note')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'openai_structured_output' — structured LLM insight path
--   'rules_engine'             — deterministic rules-engine path
--   'operator_note'            — operator-authored insight note
--
-- ai_insights.source gates provenance presentation and generation-path
-- identity. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins #521 (risk_level), #520 (status), #483
-- (provenance), and #479 (schema_version) leave source on bare IN only.
-- Provenance (#483) pins a server-side composition involving source =
-- rules_engine; it does not replace this column-level allowlist.
--
-- If LC_CTYPE drifted under a bare-IN ai_insights.source CHECK,
-- dump/restore could accept insight source bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking AI insight continuity across restore.
--
-- Scope:
--   - Replace ai_insights_source_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite private.service_create_rules_engine_ai_insight,
-- ai_insights risk_level (#521), status (#520), provenance (#483),
-- schema_version (#479), output bounds, or other bare-IN vocabularies.
-- Timestamp after MISE-005DI (#521).

alter table public.ai_insights
  drop constraint if exists ai_insights_source_check;

alter table public.ai_insights
  add constraint ai_insights_source_check
  check (
    source in ('openai_structured_output', 'rules_engine', 'operator_note')
    and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ai_insights_source_check
  on public.ai_insights is
  'MISE-005DJ: exact openai_structured_output/rules_engine/operator_note allowlist plus ASCII shape under COLLATE "C". AI insight generation source.';

comment on column public.ai_insights.source is
  'AI insight generation source. Allowed values: openai_structured_output, rules_engine, operator_note under COLLATE "C".';
