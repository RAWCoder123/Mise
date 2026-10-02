-- MISE-005FC: pin public.activity_events.source CHECK to reject control
-- characters under COLLATE "C".
--
-- activity_events.source was declared as
--   source text not null check (length(trim(source)) between 1 and 80)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- source is durable single-line system label text on the append-only activity
-- feed (e.g. 'mise', 'inventory', 'pos'). It is not operator free-form and must
-- not accept LF/TAB/CR. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept source bytes a restored C-locale path would
-- refuse — or the reverse — breaking activity-feed continuity across restore.
--
-- Scope:
--   - Reattach activity_events_source_check preserving the exact
--     length(trim(source)) 1..80 bound PLUS ASCII control rejection under
--     COLLATE "C"
-- Does NOT rewrite activity RPCs, title (#560), summary (#564),
-- trigger_type, or restaurant_memories.source (#566).
-- Timestamp after MISE-005FB (#566).

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
        con.conname = 'activity_events_source_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%source%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%source_systems%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
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
  drop constraint if exists activity_events_source_check;

alter table public.activity_events
  add constraint activity_events_source_check check (
    length(trim(source)) between 1 and 80
    and source collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint activity_events_source_check on public.activity_events is
  'MISE-005FC: activity event source length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
