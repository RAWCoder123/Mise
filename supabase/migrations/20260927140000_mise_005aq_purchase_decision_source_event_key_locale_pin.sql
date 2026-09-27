-- MISE-005AQ: pin public.purchase_decision_events.source_event_key shape
-- CHECK to COLLATE "C".
--
-- public.purchase_decision_events still stores source_event_key under a
-- length-only bound from MISE-004A:
--   length(source_event_key) between 8 and 200
-- Writers mint durable idempotency keys as ASCII tokens:
--   'audit_log:' || audit_log_id::text
--   'purchase_decision_exclusion:' || target.id::text
-- with pgTAP fixtures using the same ASCII vocabulary (hyphenated labels).
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- source_event_key is the durable per-restaurant unique key for append-only
-- purchase-decision evidence (UNIQUE (restaurant_id, source_event_key)).
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned recommendation_unit cntrl (#416), currency (#446), and
-- provider failure codes (#450), but left this idempotency key on
-- length-only bounds.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a source_event_key the restored C-locale ASCII gate would refuse (or
-- the reverse), breaking purchase-decision evidence continuity and unique
-- key identity across restore.
--
-- Scope:
--   - Replace length-only source_event_key CHECK with named shape CHECK:
--     source_event_key collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'
-- Does NOT rewrite private.record_purchase_decision_base_event /
-- private.record_purchase_decision_compensation (key mint stays server-
-- owned), recommendation_unit cntrl (#416), currency (#446), or purchase
-- line writers (#397/#398/#414/#415).
-- Timestamp after MISE-005AP (#450).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.purchase_decision_events'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'purchase_decision_events_source_event_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source_event_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(source_event_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9:_-]{8,200}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.purchase_decision_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_source_event_key_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_source_event_key_check check (
    source_event_key collate "C" ~ '^[A-Za-z0-9:_-]{8,200}$'
  );

comment on constraint purchase_decision_events_source_event_key_check
  on public.purchase_decision_events is
  'MISE-005AQ: ASCII purchase-decision source_event_key under COLLATE "C".';
