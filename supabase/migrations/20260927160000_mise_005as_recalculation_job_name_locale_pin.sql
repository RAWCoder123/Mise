-- MISE-005AS: pin public.recalculation_runs.job_name shape CHECK to
-- COLLATE "C".
--
-- public.recalculation_runs still stores job_name under a length-only bound
-- from the recalculation run ledger:
--   length(trim(job_name)) between 1 and 80
-- Writers mint durable ASCII tokens from the cycle definition table:
--   'recalculation.daily_open'
--   'recalculation.mid_shift'
--   'recalculation.close'
-- (services/domain/recalculationSchedule.ts → recalculationPorts.ts).
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- job_name is the durable human-readable cycle identity recorded on every
-- append-only recalculation attempt. POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; MISE-005AR (#452) pinned cycle_key / idempotency_key, but
-- left job_name on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a job_name the restored C-locale ASCII gate would refuse (or the reverse),
-- breaking recalculation attempt continuity and schedule correlation across
-- restore.
--
-- Scope:
--   - Replace length-only job_name CHECK with named shape CHECK:
--     job_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
-- Does NOT rewrite public.record_recalculation_run (job mint stays
-- application-owned via services/domain/recalculationSchedule.ts),
-- cycle_key / idempotency_key (#452), purchase_decision source_event_key
-- (#451), or provider failure_code (#450).
-- Timestamp after MISE-005AR (#452).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.recalculation_runs'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'recalculation_runs_job_name_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%job_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(job_name))%'
            or pg_get_constraintdef(con.oid) ilike '%length(job_name)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9._-]{1,80}$%'
          )
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
  drop constraint if exists recalculation_runs_job_name_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_job_name_check check (
    job_name collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint recalculation_runs_job_name_check
  on public.recalculation_runs is
  'MISE-005AS: ASCII recalculation job_name under COLLATE "C".';
