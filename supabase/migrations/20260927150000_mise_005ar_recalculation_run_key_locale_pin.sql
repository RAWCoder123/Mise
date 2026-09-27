-- MISE-005AR: pin public.recalculation_runs cycle_key and idempotency_key
-- shape CHECKs to COLLATE "C".
--
-- public.recalculation_runs still stores cycle_key and idempotency_key under
-- length-only bounds from the recalculation run ledger:
--   length(trim(cycle_key)) between 1 and 240
--   length(trim(idempotency_key)) between 1 and 240
-- Writers mint durable ASCII tokens:
--   cycle_key := 'recalc:' || restaurant_id || ':' || operating_date || ':' || cycle
--   idempotency_key := cycle_key || ':attempt-' || attempt
-- with pgTAP fixtures using the same ASCII vocabulary (UUID + ISO date +
-- daily_open|mid_shift|close + attempt-N).
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- idempotency_key is the durable per-restaurant unique key for append-only
-- recalculation attempt evidence (UNIQUE (restaurant_id, idempotency_key)).
-- cycle_key correlates retries of the same service-day cycle. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; later 005* tips pinned
-- purchase-decision source_event_key (#451) and provider failure codes
-- (#450), but left recalculation identity keys on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a cycle_key / idempotency_key the restored C-locale ASCII gate would
-- refuse (or the reverse), breaking recalculation attempt continuity and
-- unique key identity across restore.
--
-- Scope:
--   - Replace length-only cycle_key CHECK with named shape CHECK:
--     cycle_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
--   - Replace length-only idempotency_key CHECK with named shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
-- Does NOT rewrite public.record_recalculation_run (key mint stays
-- application-owned via services/application/recalculationPorts.ts),
-- purchase_decision source_event_key (#451), or provider failure_code
-- (#450).
-- Timestamp after MISE-005AQ (#451).

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
        con.conname in (
          'recalculation_runs_cycle_key_check',
          'recalculation_runs_idempotency_key_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%cycle_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(cycle_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(cycle_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,240}$%'
          )
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(idempotency_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,240}$%'
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
  drop constraint if exists recalculation_runs_cycle_key_check;

alter table public.recalculation_runs
  drop constraint if exists recalculation_runs_idempotency_key_check;

alter table public.recalculation_runs
  add constraint recalculation_runs_cycle_key_check check (
    cycle_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

alter table public.recalculation_runs
  add constraint recalculation_runs_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

comment on constraint recalculation_runs_cycle_key_check
  on public.recalculation_runs is
  'MISE-005AR: ASCII recalculation cycle_key under COLLATE "C".';

comment on constraint recalculation_runs_idempotency_key_check
  on public.recalculation_runs is
  'MISE-005AR: ASCII recalculation idempotency_key under COLLATE "C".';
