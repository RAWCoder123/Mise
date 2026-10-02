-- MISE-005FJ: pin public.activity_events.sequence_id CHECK to reject
-- control characters under COLLATE "C".
--
-- activity_events.sequence_id was declared as nullable text with no
-- CHECK. The record_activity writer already normalizes via
--   nullif(left(trim(p_sequence_id), 240), '')
-- so empty/whitespace becomes null and values are truncated to 240. There was
-- still no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- sequence_id is durable single-line system sequence/correlation labels on the
-- append-only activity feed (restaurant_task:<id>, recalculation:<date>:<cycle>,
-- and similar system keys). It is not operator free-form and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept sequence_id bytes a restored C-locale path would
-- refuse — or the reverse — breaking activity-feed continuity across restore.
--
-- Scope:
--   - Attach activity_events_sequence_id_check as null OR
--     length(trim(sequence_id)) 1..240 PLUS ASCII control rejection
--     under COLLATE "C" (matches writer 240 bound)
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- trigger_type (#568), idempotency_key (#569), trigger_reference (#571),
-- related_entity_type (#572), related_entity_id (#573), restaurant_memories.*,
-- or operational_issues.*.
-- Timestamp after MISE-005FI (#573).

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
        con.conname = 'activity_events_sequence_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%sequence_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%sequence_id%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_id%'
          and pg_get_constraintdef(con.oid) not ilike '%related_entity_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%correlation_id%'
          and pg_get_constraintdef(con.oid) not ilike '%causation_id%'
          and pg_get_constraintdef(con.oid) not ilike '%source_systems%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
          and pg_get_constraintdef(con.oid) not ilike '%error_message%'
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
  drop constraint if exists activity_events_sequence_id_check;

alter table public.activity_events
  add constraint activity_events_sequence_id_check check (
    sequence_id is null
    or (
      length(trim(sequence_id)) between 1 and 240
      and sequence_id collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint activity_events_sequence_id_check on public.activity_events is
  'MISE-005FJ: activity event sequence_id null or length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
