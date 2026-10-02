-- MISE-005FE: pin public.activity_events.idempotency_key CHECK to reject
-- control characters under COLLATE "C".
--
-- activity_events.idempotency_key was declared as
--   idempotency_key text not null check (length(trim(idempotency_key)) between 1 and 240)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- idempotency_key is the durable per-restaurant unique activity identity
-- (UNIQUE (restaurant_id, idempotency_key)). Hosted and domain writers mint
-- single-line system keys that intentionally include ISO-8601 punctuation and
-- occasional label text (spaces / non-ASCII presentation), for example:
--   restaurant_task:<uuid>:created
--   inventory_count:<itemId>:<ISO occurredAt>
--   memory_updated:<restaurantId>:<ISO hour bucket>:<memory.label>
--   pos_sync:<importId or ISO occurredAt>
-- It is not operator free-form multiline text and must not accept LF/TAB/CR/NUL.
-- A narrow ASCII charset tip would reject valid ISO / label mints; control
-- rejection preserves those writers while closing the locale-drift hole.
-- If LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore could
-- accept idempotency_key bytes a restored C-locale path would refuse — or the
-- reverse — breaking activity-feed dedupe continuity across restore.
--
-- Scope:
--   - Reattach activity_events_idempotency_key_check preserving the exact
--     length(trim(idempotency_key)) 1..240 bound PLUS ASCII control rejection
--     under COLLATE "C"
-- Does NOT rewrite activity RPCs, title (#560), summary (#564), source (#567),
-- trigger_type (#568), trigger_reference, restaurant_memories.*, or sibling
-- table idempotency tips (#457/#459/#471).
-- Timestamp after MISE-005FD (#568).

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
        con.conname = 'activity_events_idempotency_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%idempotency_key%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%title%'
          and pg_get_constraintdef(con.oid) not ilike '%summary%'
          and pg_get_constraintdef(con.oid) not ilike '%source%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_type%'
          and pg_get_constraintdef(con.oid) not ilike '%trigger_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%source_systems%'
          and pg_get_constraintdef(con.oid) not ilike '%event_type%'
          and pg_get_constraintdef(con.oid) not ilike '%category%'
          and pg_get_constraintdef(con.oid) not ilike '%actor_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%error_code%'
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
  drop constraint if exists activity_events_idempotency_key_check;

alter table public.activity_events
  add constraint activity_events_idempotency_key_check check (
    length(trim(idempotency_key)) between 1 and 240
    and idempotency_key collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint activity_events_idempotency_key_check on public.activity_events is
  'MISE-005FE: activity event idempotency_key length(trim) 1..240 plus ASCII control rejection under COLLATE "C".';
