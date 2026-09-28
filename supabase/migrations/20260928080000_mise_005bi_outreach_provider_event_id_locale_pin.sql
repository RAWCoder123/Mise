-- MISE-005BI: pin public.outreach_events.provider_event_id CHECK to
-- COLLATE "C".
--
-- public.outreach_events.provider_event_id is still unbound text (NOT NULL,
-- UNIQUE). The outreach-webhook Edge function persists the verified Svix
-- `svix-id` header as the durable webhook idempotency key and treats unique
-- violations (23505) as successful replays. There is no length or charset
-- CHECK, so control-bearing or over-long ids can land via service_role while
-- sibling provider identity pins (Gmail provider_subject #464, Square
-- merchant_id #460, supplier_email_deliveries.provider_message_id #444) already
-- reject ASCII controls under COLLATE "C".
--
-- provider_event_id is the restore/audit key for Resend/Svix delivery
-- lifecycle events (delivered, bounced, complained, suppressed). Demo and
-- unit fixtures do not seed outreach_events rows; production writers use
-- printable ASCII Svix message ids. Client SELECT/INSERT/UPDATE/DELETE are
-- revoked for anon/authenticated; only service_role writes.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; later 005* tips pinned outreach email/URL/timezone shape
-- (#420/#421/#443/#463) and Gmail/Square provider ids, but left
-- outreach_events.provider_event_id unbound because outreach webhook writers
-- were not on the contested restaurant Expo path.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- webhook event identity the restored C-locale sibling provider-id gates
-- would refuse (or the reverse), breaking Svix replay idempotency and
-- delivery-event continuity across restore.
--
-- Scope:
--   - Add named length + cntrl CHECK under COLLATE "C" for
--     provider_event_id (length 1–255; empty rejected).
--   - Does NOT rewrite supabase/functions/outreach-webhook/index.ts,
--     outreach_messages.provider_message_id / idempotency_key,
--     outreach_events.provider_message_id / event_type free-form values,
--     supplier_email_deliveries.provider_message_id (#444), or
--     activity_events / restaurant_memories / inventory_events.
-- Timestamp after MISE-005BH (#468 modifier_recipe_adjustments identity).

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
        con.conname = 'outreach_events_provider_event_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%provider_event_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(provider_event_id)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
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
  drop constraint if exists outreach_events_provider_event_id_check;

alter table public.outreach_events
  add constraint outreach_events_provider_event_id_check
    check (
      length(provider_event_id) between 1 and 255
      and provider_event_id collate "C" !~ '[[:cntrl:]]'
    );

comment on constraint outreach_events_provider_event_id_check
  on public.outreach_events is
  'MISE-005BI: provider_event_id length 1–255 and ASCII C [[:cntrl:]] rejection (COLLATE "C"); Svix webhook idempotency key.';
