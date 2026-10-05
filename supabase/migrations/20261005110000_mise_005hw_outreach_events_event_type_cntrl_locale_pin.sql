-- MISE-005HW: pin public.outreach_events.event_type CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_events.event_type was declared as
--   event_type text not null
--     check (char_length(btrim(event_type)) between 1 and 100)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- event_type is a durable single-line Resend/Svix delivery lifecycle label
-- (delivered, bounced, complained, suppressed, …) on service-only Mise sales
-- outreach events. It is not operator free-form multiline prose and must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept event_type bytes a restored C-locale path
-- would refuse — or the reverse — breaking outreach delivery-event continuity
-- across restore.
--
-- Scope:
--   - Reattach outreach_events_event_type_check preserving the exact
--     char_length(btrim(event_type)) 1..100 bound PLUS ASCII control rejection
--     under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus provider_event_id
--     (#469 / MISE-005BI), provider_message_id (#470 / MISE-005BJ),
--     outreach_messages.* (#638/#637/#636/#635/#519), and campaign/lead tips
-- Does NOT rewrite outreach-webhook / Edge Functions, provider_event_id,
-- provider_message_id, or restaurant-tenant tables.
-- Timestamp after MISE-005HV (#638).

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
        con.conname = 'outreach_events_event_type_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%event_type%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%event_type%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%event_type%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%provider_event_id%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and con.conname is distinct from 'outreach_events_provider_event_id_check'
          and con.conname is distinct from 'outreach_events_provider_message_id_check'
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
  drop constraint if exists outreach_events_event_type_check;

alter table public.outreach_events
  add constraint outreach_events_event_type_check check (
    char_length(btrim(event_type)) between 1 and 100
    and event_type collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint outreach_events_event_type_check
  on public.outreach_events is
  'MISE-005HW: outreach_events event_type char_length(btrim) 1..100 plus ASCII control rejection under COLLATE "C".';
