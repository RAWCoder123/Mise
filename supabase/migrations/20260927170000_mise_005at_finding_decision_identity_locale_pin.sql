-- MISE-005AT: pin public.operational_finding_decisions client_event_id and
-- idempotency_key shape CHECKs to COLLATE "C".
--
-- public.operational_finding_decisions still stores client_event_id and
-- idempotency_key under length-only bounds from the finding-decision ledger:
--   length(trim(client_event_id)) between 1 and 200
--   length(trim(idempotency_key)) between 1 and 240
-- Writers mint durable ASCII tokens:
--   client_event_id := createId('finding_decision')
--     → 'finding_decision_' || uuid
--   idempotency_key := 'finding-decision:' || client_event_id
-- with pgTAP / unit fixtures using the same ASCII vocabulary
-- (device-a:finding-decision-N / finding-decision:device-a:N).
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- client_event_id and idempotency_key are the durable per-restaurant unique
-- keys for append-only manager finding-decision evidence
-- (UNIQUE (restaurant_id, client_event_id) and
-- UNIQUE (restaurant_id, idempotency_key)). POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; later 005* tips pinned finding_id (#442) and
-- policy_version (#440) on the same table, and recalculation job_name
-- (#453), but left these client identity keys on length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a client_event_id / idempotency_key the restored C-locale ASCII gate would
-- refuse (or the reverse), breaking finding-decision evidence continuity and
-- unique key identity across restore.
--
-- Scope:
--   - Replace length-only client_event_id CHECK with named shape CHECK:
--     client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
--   - Replace length-only idempotency_key CHECK with named shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
-- Does NOT rewrite public.record_operational_finding_decision (finding_id /
-- policy_version owned by open #440/#442; identity mint stays application-
-- owned via services/application/findingDecisionOutbox.ts),
-- recalculation job_name (#453), or purchase_decision source_event_key
-- (#451).
-- Timestamp after MISE-005AS (#453).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.operational_finding_decisions'::regclass
      and con.contype = 'c'
      and (
        con.conname in (
          'operational_finding_decisions_client_event_id_check',
          'operational_finding_decisions_idempotency_key_check'
        )
        or (
          pg_get_constraintdef(con.oid) ilike '%client_event_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(client_event_id))%'
            or pg_get_constraintdef(con.oid) ilike '%length(client_event_id)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{1,200}$%'
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
      'alter table public.operational_finding_decisions drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.operational_finding_decisions
  drop constraint if exists operational_finding_decisions_client_event_id_check;

alter table public.operational_finding_decisions
  drop constraint if exists operational_finding_decisions_idempotency_key_check;

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_client_event_id_check check (
    client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
  );

alter table public.operational_finding_decisions
  add constraint operational_finding_decisions_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

comment on constraint operational_finding_decisions_client_event_id_check
  on public.operational_finding_decisions is
  'MISE-005AT: ASCII finding-decision client_event_id under COLLATE "C".';

comment on constraint operational_finding_decisions_idempotency_key_check
  on public.operational_finding_decisions is
  'MISE-005AT: ASCII finding-decision idempotency_key under COLLATE "C".';
