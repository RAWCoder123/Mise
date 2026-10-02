-- MISE-005FH: pin public.activity_events.related_entity_type CHECK to reject
-- control characters under COLLATE "C".
--
-- activity_events.related_entity_type was declared as nullable text with no
-- CHECK. The record_activity writer already normalizes via
--   nullif(left(trim(p_related_entity_type), 80), '')
-- so empty/whitespace becomes null and values are truncated to 80. There was
-- still no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- related_entity_type is durable single-line system entity-type labels on the
-- append-only activity feed (inventory_item, supplier_order, restaurant_task,
-- purchase_recommendation, finding, pos_import, memory, etc.). It is not
-- operator free-form and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept
-- related_entity_type bytes a restored C-locale path would refuse — or the
-- reverse — breaking activity-feed continuity across restore.
--
-- Scope:
--   - Attach activity_events_related_entity_type_check as null OR
--     length(trim(related_entity_type)) 1..80 PLUS ASCII control rejection
--     under COLLATE "C" (matches writer 80 bound)
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- trigger_type (#568), idempotency_key (#569), trigger_reference (#571),
-- related_entity_id, restaurant_memories.*, or operational_issues.*.
-- Timestamp after MISE-005FG (#571).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.activity_events'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'activity_events_related_entity_type_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%related_entity_type%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%related_entity_type%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_id%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%source_systems%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%error_message%'
          and pg_get_constraintdef(con.oid) not ilike '%sequence_id%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.activity_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.activity_events
  drop constraint if exists activity_events_related_entity_type_check;

alter table public.activity_events
  add constraint activity_events_related_entity_type_check check (
    related_entity_type is null
    or (
      length(trim(related_entity_type)) between 1 and 80
      and related_entity_type collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint activity_events_related_entity_type_check on public.activity_events is
  'MISE-005FH: activity event related_entity_type null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
