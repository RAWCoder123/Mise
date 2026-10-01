-- MISE-005ER: pin public.restaurant_tasks.title CHECK to reject control
-- characters under COLLATE "C".
--
-- restaurant_tasks.title only enforced
--   length(trim(title)) between 1 and 160
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Task title is durable single-line operator text on the shared restaurant
-- task ledger (create-task title field). If LC_CTYPE drifted under a bare
-- (or missing) cntrl gate, dump/restore could accept title bytes a restored
-- C-locale path would refuse — or the reverse — breaking task-evidence
-- continuity across restore.
--
-- Scope:
--   - Reattach restaurant_tasks_title_check preserving the exact
--     length(trim(title)) between 1 and 160 bound PLUS ASCII control
--     rejection under COLLATE "C"
-- Does NOT rewrite create/complete/cancel task RPCs, detail (#554),
-- completion_result, client_task_id (#455), service_window (#505),
-- verification_method (#504), or recalculation_runs.failure_reason (#555).
-- Timestamp after MISE-005EQ (#555).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.restaurant_tasks'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'restaurant_tasks_title_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%title%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%title%'
          and pg_get_constraintdef(con.oid) not ilike '%detail%'
          and pg_get_constraintdef(con.oid) not ilike '%completion_result%'
          and pg_get_constraintdef(con.oid) not ilike '%client_task_id%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.restaurant_tasks drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.restaurant_tasks
  drop constraint if exists restaurant_tasks_title_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_title_check check (
    length(trim(title)) between 1 and 160
    and title collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint restaurant_tasks_title_check on public.restaurant_tasks is
  'MISE-005ER: restaurant task title length(trim) 1..160 plus ASCII control rejection under COLLATE "C".';
