-- MISE-005BW: pin public.ai_insights server provenance CHECKs
-- (source + generated_by) to COLLATE "C", preserving exact-token allowlists.
--
-- public.ai_insights stores server provenance under bare equality / IN
-- allowlists from the profile / AI boundary hardening migration:
--   source = 'rules_engine'
--   and generated_by in (
--     'edge_function_scaffold', 'mise_rules', 'staging_seed', 'legacy_unverified'
--   )
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens:
--   source := 'rules_engine'
--   generated_by := 'edge_function_scaffold'
--     (private.service_create_rules_engine_ai_insight)
--   plus backfill / seed tokens mise_rules, staging_seed, legacy_unverified.
--
-- source and generated_by are the durable provenance contract for
-- append-only structured AI insight rows. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; later 005* tips pinned
-- ai_insights.schema_version (#479) but left server provenance on bare
-- equality / IN only.
--
-- If LC_CTYPE drifted under a bare-equality provenance CHECK, dump/restore
-- could accept provenance bytes the restored C-locale path (and sibling
-- machine-identity gates) would refuse — or the reverse — breaking AI
-- insight provenance continuity across restore.
--
-- Scope:
--   - Replace ai_insights_server_provenance_check with exact-token
--     allowlists PLUS ASCII shape under COLLATE "C":
--       source = 'rules_engine'
--       and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
--       and generated_by in (
--         'edge_function_scaffold', 'mise_rules', 'staging_seed',
--         'legacy_unverified'
--       )
--       and generated_by collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite private.service_create_rules_engine_ai_insight,
-- schema_version (#479), output bounds, inventory_events identity (#478),
-- purchase_decision evidence_version (#482), or free-form insight titles.
-- Timestamp after MISE-005BV (#482).

alter table public.ai_insights
  drop constraint if exists ai_insights_server_provenance_check;

alter table public.ai_insights
  add constraint ai_insights_server_provenance_check check (
    source = 'rules_engine'
    and source collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
    and generated_by in (
      'edge_function_scaffold',
      'mise_rules',
      'staging_seed',
      'legacy_unverified'
    )
    and generated_by collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ai_insights_server_provenance_check
  on public.ai_insights is
  'MISE-005BW: exact rules_engine / generated_by allowlist plus ASCII shape under COLLATE "C".';
