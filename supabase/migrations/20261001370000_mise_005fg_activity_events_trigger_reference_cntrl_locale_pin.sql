-- MISE-005FG: pin public.activity_events.trigger_reference CHECK to reject
-- control characters under COLLATE "C".
--
-- activity_events.trigger_reference was declared as nullable text with no
-- CHECK. The record_activity writer already normalizes via
--   nullif(left(trim(p_trigger_reference), 240), '')
-- so empty/whitespace becomes null and values are truncated to 240. There was
-- still no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- trigger_reference is durable single-line system correlation text on the
-- append-only activity feed (UUIDs, inventory item IDs, import IDs, operating
-- dates, source document refs). It is not operator free-form and must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept trigger_reference bytes a restored C-locale
-- path would refuse — or the reverse — breaking activity-feed continuity
-- across restore.
--
-- Scope:
--   - Attach activity_events_trigger_reference_check as null OR
--     length(trim(trigger_reference)) 1..240 PLUS ASCII control rejection
--     under COLLATE "C" (matches writer 240 bound)
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- trigger_type (#568), idempotency_key (#569), restaurant_memories.*, or
-- mise_actions.trigger_reference.
-- Timestamp after MISE-005FF (#570).

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
        con.conname = 'activity_events_trigger_reference_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%trigger_reference%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%trigger_reference%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
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
          and pg_get_constraintdef(con.oid) not ilike '%related_entity%'
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
  drop constraint if exists activity_events_trigger_reference_check;

alter table public.activity_events
  add constraint activity_events_trigger_reference_check check (
    trigger_reference is null
    or (
      length(trim(trigger_reference)) between 1 and 240
      and trigger_reference collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint activity_events_trigger_reference_check on public.activity_events is
  'MISE-005FG: activity event trigger_reference null or length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
