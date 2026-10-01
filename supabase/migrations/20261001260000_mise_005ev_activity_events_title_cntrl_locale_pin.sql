-- MISE-005EV: pin public.activity_events.title CHECK to reject control
-- characters under COLLATE "C".
--
-- activity_events.title only enforced
--   length(trim(title)) between 1 and 160
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Activity title is durable single-line operator-feed text on the append-only
-- activity ledger. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept title bytes a restored C-locale path would refuse
-- — or the reverse — breaking activity-evidence continuity across restore.
--
-- Scope:
--   - Reattach activity_events_title_check preserving the exact
--     length(trim(title)) between 1 and 160 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite record_activity_event RPCs, summary/source/trigger_type
-- bounds, operational_issues.title, restaurant_tasks.title (#556), or
-- restaurant_tasks.source_reference (#559).
-- Timestamp after MISE-005EU (#559).

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
        con.conname = 'activity_events_title_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%title%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
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
  drop constraint if exists activity_events_title_check;

alter table public.activity_events
  add constraint activity_events_title_check check (
    length(trim(title)) between 1 and 160
    and title collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint activity_events_title_check on public.activity_events is
  'MISE-005EV: activity event title length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
