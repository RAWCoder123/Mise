-- MISE-005BX: pin public.purchase_recommendations.generation_source CHECK
-- to COLLATE "C", preserving the exact-token allowlist.
--
-- public.purchase_recommendations stores generation provenance under a bare
-- IN allowlist from secure_operational_workflows:
--   generation_source in ('manual', 'mise_rules', 'legacy_client')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'manual'       — operator / manual recommendation paths
--   'mise_rules'   — server-generated recommendation commit
--   'legacy_client'— retained for historical client-authored rows
--
-- generation_source is the durable provenance contract for purchase
-- recommendations and MISE-003A/004A authority (system vs manual). POSIX
-- character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned sibling machine-identity gates but left
-- purchase_recommendations.generation_source on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN generation_source CHECK, dump/restore
-- could accept provenance bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking purchase
-- recommendation provenance continuity across restore.
--
-- Scope:
--   - Replace purchase_recommendations_generation_source_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C":
--       generation_source in ('manual', 'mise_rules', 'legacy_client')
--       and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite purchase approval / decision writers, planning_revision,
-- insights.generation_source (sibling bare IN; separate tip), ai_insights
-- provenance (#483), or free-form recommendation reason text.
-- Timestamp after MISE-005BW (#483).

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_generation_source_check;

alter table public.purchase_recommendations
  add constraint purchase_recommendations_generation_source_check check (
    generation_source in ('manual', 'mise_rules', 'legacy_client')
    and generation_source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_recommendations_generation_source_check
  on public.purchase_recommendations is
  'MISE-005BX: exact manual/mise_rules/legacy_client allowlist plus ASCII shape under COLLATE "C".';
