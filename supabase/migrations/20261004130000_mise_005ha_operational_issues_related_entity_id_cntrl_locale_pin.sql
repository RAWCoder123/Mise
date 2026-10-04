-- MISE-005HA: pin public.operational_issues.related_entity_id CHECK to reject
-- control characters under COLLATE "C".
--
-- operational_issues.related_entity_id was declared as nullable text with no
-- CHECK. Writers insert system entity IDs (for example inventory_item_id::text
-- from the purchase_recommendations sync trigger / backfill). The
-- activity_events sibling column already normalizes via
--   nullif(left(trim(p_related_entity_id), 240), '')
-- and was tipped as MISE-005FI (#573) with the same 240 ceiling. There was
-- still no length or control-character gate on operational_issues.related_entity_id.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- related_entity_id is a durable nullable single-line system entity-id key on
-- the operational issues ledger (inventory item IDs, recommendation IDs, etc.).
-- It is not operator free-form and must not accept LF/TAB/CR/NUL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- related_entity_id bytes a restored C-locale path would refuse — or the
-- reverse — breaking issue-entity linkage continuity across restore.
--
-- Scope:
--   - Attach operational_issues_related_entity_id_check as null OR
--     length(trim(related_entity_id)) 1..240 PLUS ASCII control rejection
--     under COLLATE "C" (mirrors activity_events related_entity_id / #573)
-- Does NOT rewrite the purchase_recommendations sync trigger, backfill,
-- title (#561), explanation (#562), dedupe_key (#456), category / severity /
-- status allowlists, related_entity_type (#616), or activity_events.*.
-- Timestamp after MISE-005GZ (#616).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.operational_issues'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'operational_issues_related_entity_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%related_entity_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%related_entity_id%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_type%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%explanation%'
          and pg_get_constraintdef(con.oid) not ilike '%dedupe_key%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%severity%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%evidence%'
          and pg_get_constraintdef(con.oid) not ilike '%window%'
          and pg_get_constraintdef(con.oid) not ilike '%location%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.operational_issues drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_issues
  drop constraint if exists operational_issues_related_entity_id_check;

alter table public.operational_issues
  add constraint operational_issues_related_entity_id_check check (
    related_entity_id is null
    or (
      length(trim(related_entity_id)) between 1 and 240
      and related_entity_id collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint operational_issues_related_entity_id_check
  on public.operational_issues is
  'MISE-005HA: operational issue related_entity_id null or length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
