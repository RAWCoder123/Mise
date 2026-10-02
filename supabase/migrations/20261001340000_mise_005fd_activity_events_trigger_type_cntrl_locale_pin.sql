-- MISE-005FD: pin public.activity_events.trigger_type CHECK to reject control
-- characters under COLLATE "C".
--
-- activity_events.trigger_type was declared as
--   trigger_type text not null check (length(trim(trigger_type)) between 1 and 120)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- trigger_type is durable single-line system label text on the append-only
-- activity feed (e.g. 'supplier_delivery_outcome', 'purchase_line_ingestion',
-- 'inventory_count_recorded'). It is not operator free-form and must not accept
-- LF/TAB/CR. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept trigger_type bytes a restored C-locale path would
-- refuse — or the reverse — breaking activity-feed continuity across restore.
--
-- Scope:
--   - Reattach activity_events_trigger_type_check preserving the exact
--     length(trim(trigger_type)) 1..120 bound PLUS ASCII control rejection under
--     COLLATE "C"
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- idempotency_key, or restaurant_memories.* tips.
-- Timestamp after MISE-005FC (#567).

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
        con.conname = 'activity_events_trigger_type_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
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
  drop constraint if exists activity_events_trigger_type_check;

alter table public.activity_events
  add constraint activity_events_trigger_type_check check (
    length(trim(trigger_type)) between 1 and 120
    and trigger_type collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint activity_events_trigger_type_check on public.activity_events is
  'MISE-005FD: activity event trigger_type length(trim) 1..120 plus ASCII control rejection under COLLATE "C".';
