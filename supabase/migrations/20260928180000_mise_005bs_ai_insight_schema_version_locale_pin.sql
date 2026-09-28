-- MISE-005BS: pin public.ai_insights.schema_version shape CHECK to
-- COLLATE "C".
--
-- public.ai_insights still stores schema_version under a length-only bound
-- from the profile / AI boundary hardening migration:
--   pg_catalog.length(schema_version) between 1 and 80
-- Writers mint the durable ASCII version token:
--   'mise.ai_insight.v1'
-- (private.service_create_rules_engine_ai_insight, services/ai/structuredInsights.ts,
-- supabase/functions/_shared/mise.ts). Length-only CHECKs accept spaces,
-- control bytes, and non-ASCII that the restored C-locale path would treat
-- differently under LC_CTYPE drift.
--
-- schema_version is the durable contract identity for append-only structured
-- AI insight rows. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned recalculation job_name (#453) and sibling
-- machine identities through inventory_events (#478), but left
-- ai_insights.schema_version on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a schema_version the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking AI insight contract continuity across restore.
--
-- Scope:
--   - Replace length-only schema_version CHECK with named shape CHECK:
--     schema_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite private.service_create_rules_engine_ai_insight,
-- ai_insights.source / generated_by provenance CHECKs, output bounds,
-- inventory_events identity (#478), or free-form insight titles.
-- Timestamp after MISE-005BR (#478).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.ai_insights'::regclass
      and con.contype = 'c'
      and (
        con.conname in (
          'ai_insights_schema_version_length_check',
          'ai_insights_schema_version_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%schema_version%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(schema_version)%'
            or pg_get_constraintdef(con.oid) ilike '%length(trim(schema_version))%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9._-]{1,80}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.ai_insights drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.ai_insights
  drop constraint if exists ai_insights_schema_version_length_check;

alter table public.ai_insights
  drop constraint if exists ai_insights_schema_version_check;

alter table public.ai_insights
  add constraint ai_insights_schema_version_check check (
    schema_version collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint ai_insights_schema_version_check
  on public.ai_insights is
  'MISE-005BS: ASCII ai_insights.schema_version under COLLATE "C".';
