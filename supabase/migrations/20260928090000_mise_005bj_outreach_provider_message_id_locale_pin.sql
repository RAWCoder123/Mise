-- MISE-005BJ: pin public.outreach_messages.provider_message_id and
-- public.outreach_events.provider_message_id CHECKs to COLLATE "C".
--
-- Both columns are still unbound nullable text:
--   outreach_messages.provider_message_id text unique
--   outreach_events.provider_message_id text
-- with no length or charset CHECK. The outreach-agent Edge function persists
-- the Resend emails API `id` onto outreach_messages after a successful send;
-- outreach-webhook copies the same provider id onto outreach_events and uses
-- it to join events back to messages. Unique violations are not expected on
-- the event column (no UNIQUE), but message rows treat the id as durable
-- join/restore identity.
--
-- Sibling provider_message_id pins already reject ASCII controls under
-- COLLATE "C" at length 1–512 (#444 supplier_email_deliveries, #445
-- supplier_orders). outreach_events.provider_event_id (#469) pins Svix
-- webhook ids similarly. These Resend message-id columns remained unbound
-- because outreach writers are service_role-only and outside the contested
-- restaurant Expo path.
--
-- Demo and unit fixtures do not seed control-bearing Resend ids; production
-- writers use printable ASCII Resend email ids. Client SELECT/INSERT/UPDATE/
-- DELETE are revoked for anon/authenticated; only service_role writes.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. If LC_CTYPE drifted with no shape CHECK, dump/restore could accept
-- a Resend message identity the restored C-locale sibling provider-id gates
-- would refuse (or the reverse), breaking message↔event join continuity and
-- webhook delivery updates across restore.
--
-- Scope:
--   - Add named nullable length + cntrl CHECKs under COLLATE "C" for
--     outreach_messages.provider_message_id and
--     outreach_events.provider_message_id (length 1–512 when present;
--     empty rejected; null allowed).
--   - Does NOT rewrite supabase/functions/outreach-agent/index.ts,
--     supabase/functions/outreach-webhook/index.ts,
--     outreach_messages.idempotency_key, outreach_events.provider_event_id
--     (#469), outreach_events.event_type, supplier_email_deliveries /
--     supplier_orders provider_message_id (#444/#445), or
--     activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BI (#469 outreach_events.provider_event_id).

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
        con.conname = 'outreach_messages_provider_message_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_message_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(provider_message_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
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
  drop constraint if exists outreach_messages_provider_message_id_check;

alter table public.outreach_messages
  add constraint outreach_messages_provider_message_id_check
    check (
      provider_message_id is null
      or (
        length(provider_message_id) between 1 and 512
        and provider_message_id collate "C" !~ '[[:cntrl:]]'
      )
    );

comment on constraint outreach_messages_provider_message_id_check
  on public.outreach_messages is
  'MISE-005BJ: optional provider_message_id length 1–512 and ASCII C [[:cntrl:]] rejection (COLLATE "C"); Resend email id.';

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.outreach_events'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'outreach_events_provider_message_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_message_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(provider_message_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%provider_event_id%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.outreach_events drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.outreach_events
  drop constraint if exists outreach_events_provider_message_id_check;

alter table public.outreach_events
  add constraint outreach_events_provider_message_id_check
    check (
      provider_message_id is null
      or (
        length(provider_message_id) between 1 and 512
        and provider_message_id collate "C" !~ '[[:cntrl:]]'
      )
    );

comment on constraint outreach_events_provider_message_id_check
  on public.outreach_events is
  'MISE-005BJ: optional provider_message_id length 1–512 and ASCII C [[:cntrl:]] rejection (COLLATE "C"); Resend email id join key.';
