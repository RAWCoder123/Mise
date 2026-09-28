-- MISE-005BK: pin public.outreach_messages.idempotency_key shape CHECK to
-- COLLATE "C".
--
-- public.outreach_messages still stores idempotency_key as unbound NOT NULL
-- text from the outreach_agent foundation migration:
--   idempotency_key text not null
--     default ('outreach_' || replace(gen_random_uuid()::text, '-', ''))
--     unique
-- with no length or charset CHECK. The default mint is always
-- `outreach_` + 32 hex digits (41 ASCII bytes). outreach-agent reads the
-- stored key and sends it as the Resend `Idempotency-Key` header; it never
-- invents a client-supplied alternate. Without a shape gate, dump/restore
-- under LC_CTYPE drift could accept spaces, control bytes, or non-ASCII that
-- the restored C-locale path would refuse (or the reverse), breaking Resend
-- send idempotency continuity across restore.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned outreach provider_event_id (#469) and
-- provider_message_id (#470), and sibling action/confirmation idempotency
-- keys (#457/#459), but left outreach_messages.idempotency_key unbound
-- because outreach is service_role-only and outside the contested restaurant
-- Expo path.
--
-- Scope:
--   - Add named ASCII shape CHECK under COLLATE "C":
--     idempotency_key collate "C" ~ '^[A-Za-z0-9_]{1,64}$'
--     (covers the 41-byte default mint with headroom; rejects space/cntrl/
--     hyphen/colon/non-ASCII)
-- Does NOT rewrite supabase/functions/outreach-agent/index.ts,
-- outreach provider_message_id (#470), provider_event_id (#469),
-- activity_events.idempotency_key, restaurant_memories.dedupe_key,
-- inventory_events identity (#375), or mise_actions / action_outcomes
-- idempotency keys (#457).
-- Timestamp after MISE-005BJ (#470 outreach provider_message_id).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_messages'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_messages_idempotency_key_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%idempotency_key%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(trim(idempotency_key))%'
            or pg_get_constraintdef(con.oid) ilike '%length(idempotency_key)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9_]{1,64}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_messages drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_messages
  drop constraint if exists outreach_messages_idempotency_key_check;

alter table public.outreach_messages
  add constraint outreach_messages_idempotency_key_check check (
    idempotency_key collate "C" ~ '^[A-Za-z0-9_]{1,64}$'
  );

comment on constraint outreach_messages_idempotency_key_check
  on public.outreach_messages is
  'MISE-005BK: ASCII outreach_messages.idempotency_key under COLLATE "C" (outreach_ + hex uuid mint).';
