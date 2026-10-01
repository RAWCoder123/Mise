-- MISE-005EQ: pin public.recalculation_runs.failure_reason CHECK to reject
-- control characters under COLLATE "C".
--
-- failure_reason only enforced
--   failure_reason is null or length(trim(failure_reason)) between 1 and 200
-- It had no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Recalculation failure_reason is durable operational diagnostic text on the
-- run ledger (system-generated from cycle errors / timeouts). If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- reason bytes a restored C-locale path would refuse — or the reverse —
-- breaking recalculation schedule continuity and activity capture across
-- restore.
--
-- Scope:
--   - Reattach recalculation_runs_failure_reason_check preserving the exact
--     nullability + length(trim) 1..200 bound PLUS ASCII control rejection
--     under COLLATE "C"
-- Does NOT rewrite public.record_recalculation_run, recalculation_runs_failure_check
-- (status/reason consistency), status (#496), cycle/monitoring_owner (#499),
-- key (#452), or job_name (#453) pins.
-- Timestamp after MISE-005EP (#554 restaurant_tasks.detail).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.recalculation_runs'::regclass
      and con.contype = 'c'
      and con.conname <> 'recalculation_runs_failure_check'
      and (
        con.conname = 'recalculation_runs_failure_reason_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%failure_reason%'
          and pg_get_constraintdef(con.oid) ilike '%length%trim%failure_reason%'
          and pg_get_constraintdef(con.oid) not ilike '%status%failed%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.recalculation_runs drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_failure_reason_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_failure_reason_check check (
    failure_reason is null
    or (
      length(trim(failure_reason)) between 1 and 200
      and failure_reason collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint recalculation_runs_failure_reason_check
  on public.recalculation_runs is
  'MISE-005EQ: failure_reason null or length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
