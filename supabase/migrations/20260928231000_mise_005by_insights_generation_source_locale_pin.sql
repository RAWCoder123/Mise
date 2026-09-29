-- MISE-005BY: pin public.insights.generation_source CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.insights stores generation provenance under a bare
-- IN allowlist from secure_operational_workflows:
--   generation_source in ('manual', 'mise_rules', 'legacy_client')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'manual'       — operator / manual insight paths
--   'mise_rules'   — server-generated insight commit
--   'legacy_client'— retained for historical client-authored rows
--
-- generation_source is the durable provenance contract for operational
-- insights and revision-gated guidance visibility. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; MISE-005BX pinned the sibling
-- purchase_recommendations.generation_source gate but left
-- insights.generation_source on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN generation_source CHECK, dump/restore
-- could accept provenance bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking insight
-- provenance continuity across restore.
--
-- Scope:
--   - Replace insights_generation_source_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       generation_source in ('manual', 'mise_rules', 'legacy_client')
--       and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite insight commit writers, planning_revision,
-- purchase_recommendations.generation_source (#484 / MISE-005BX),
-- ai_insights provenance (#483), or free-form insight body text.
-- Timestamp after MISE-005BX (#484).

alter table public.insights
  drop constraint if exists insights_generation_source_check;

alter table public.insights
  add constraint insights_generation_source_check check (
    generation_source in ('manual', 'mise_rules', 'legacy_client')
    and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint insights_generation_source_check
  on public.insights is
  'MISE-005BY: exact manual/mise_rules/legacy_client allowlist plus ASCII shape under COLLATE "C".';
