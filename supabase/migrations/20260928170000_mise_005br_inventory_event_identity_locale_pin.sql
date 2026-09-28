-- MISE-005BR: pin public.inventory_events client_event_id and
-- idempotency_key shape CHECKs to COLLATE "C".
--
-- public.inventory_events still stores client_event_id and idempotency_key
-- under length-only bounds from the operational inventory ledger foundation:
--   length(trim(client_event_id)) between 1 and 200
--   length(trim(idempotency_key)) between 1 and 240
-- Writers mint durable ASCII tokens:
--   device outbox := createId('inventory_event') → 'inventory_event_' || uuid
--     idempotency_key := 'inventory:' || client_event_id
--   count-session approve := 'count_session:' || session_id || ':' || item_id
--     (both columns share the stable_event_key)
--   demo := 'demo:' || id / 'demo_inventory:' || id
--   fixtures := 'device-event-1', 'manager-event-1', 'receiving:delivery-1:chicken'
-- Length-only CHECKs accept spaces, control bytes, and non-ASCII that the
-- restored C-locale path would treat differently under LC_CTYPE drift.
--
-- client_event_id and idempotency_key are the durable per-restaurant unique
-- keys for append-only inventory ledger evidence
-- (UNIQUE (restaurant_id, client_event_id) and
-- UNIQUE (restaurant_id, idempotency_key)). POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; later 005* tips pinned finding-decision
-- identity (#454), restaurant_tasks.client_task_id (#455), mise_actions /
-- action_outcomes idempotency_key (#457), and supplier_deliveries identity
-- (#458), but left inventory_events identity on length-only bounds (open
-- #375 only adds oversized-length terminal messages and does not reshape
-- these CHECKs).
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept
-- a client_event_id / idempotency_key the restored C-locale ASCII gate would
-- refuse (or the reverse), breaking inventory ledger replay / dedupe identity
-- across restore.
--
-- Scope:
--   - Replace length-only client_event_id CHECK with named shape CHECK:
--     client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
--   - Replace length-only idempotency_key CHECK with named shape CHECK:
--     idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
-- Does NOT rewrite public.record_inventory_event, count-session approve
-- writers, device outbox mints, open #375 oversized-identity trigger,
-- inventory_events.source / source_reference free-form bounds, activity_events
-- idempotency_key (ISO / label mints), or restaurant_memories.dedupe_key
-- (supplier-name legacy).
-- Timestamp after MISE-005BQ (#477).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.inventory_events'::regclass
      and con.contype = 'c'
      and (
        con.conname in (
          'inventory_events_client_event_id_check',
          'inventory_events_idempotency_key_check'
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
      'alter table public.inventory_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.inventory_events
  drop constraint if exists inventory_events_client_event_id_check;

alter table public.inventory_events
  drop constraint if exists inventory_events_idempotency_key_check;

alter table public.inventory_events
  add constraint inventory_events_client_event_id_check check (
    client_event_id collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
  );

alter table public.inventory_events
  add constraint inventory_events_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9:_-]{1,240}$'
  );

comment on constraint inventory_events_client_event_id_check
  on public.inventory_events is
  'MISE-005BR: ASCII inventory-event client_event_id under COLLATE "C".';

comment on constraint inventory_events_idempotency_key_check
  on public.inventory_events is
  'MISE-005BR: ASCII inventory-event idempotency_key under COLLATE "C".';
