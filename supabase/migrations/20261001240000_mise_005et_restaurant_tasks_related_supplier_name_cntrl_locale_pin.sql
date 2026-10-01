-- MISE-005ET: pin public.restaurant_tasks.related_supplier_name CHECK to
-- reject control characters under COLLATE "C".
--
-- restaurant_tasks_supplier_bound_check only enforced
--   related_supplier_name is null or length(trim(related_supplier_name)) between 1 and 200
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- related_supplier_name is durable single-line presentation text on the shared
-- restaurant task ledger (create-task related supplier field). If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- supplier-name bytes a restored C-locale path would refuse — or the reverse —
-- breaking task-evidence continuity across restore.
--
-- Scope:
--   - Reattach restaurant_tasks_supplier_bound_check preserving the exact
--     null-or-length(trim) 1..200 bound PLUS ASCII control rejection under
--     COLLATE "C"
-- Does NOT rewrite create/complete/cancel task RPCs, title (#556), detail (#554),
-- completion_result (#557), source_reference, client_task_id (#455), or
-- recalculation_runs.failure_reason (#555).
-- Timestamp after MISE-005ES (#557).

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
        con.conname = 'restaurant_tasks_supplier_bound_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%related_supplier_name%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%related_supplier_name%'
          and pg_get_constraintdef(con.oid) not ilike '%source_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%detail%'
          and pg_get_constraintdef(con.oid) not ilike '%completion_result%'
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
  drop constraint if exists restaurant_tasks_supplier_bound_check;

alter table public.restaurant_tasks
  add constraint restaurant_tasks_supplier_bound_check check (
    related_supplier_name is null
    or (
      length(trim(related_supplier_name)) between 1 and 200
      and related_supplier_name collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint restaurant_tasks_supplier_bound_check on public.restaurant_tasks is
  'MISE-005ET: restaurant task related_supplier_name null or length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
