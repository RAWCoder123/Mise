-- MISE-005HX: pin public.outreach_messages.last_error CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_messages.last_error was declared as nullable text with no length
-- or control-character gate. Current writers persist short single-line delivery
-- / lifecycle labels such as:
--   'recipient_unsubscribed'
--   'reply_recorded'
--   'provider_response_unknown'
--   'resend_http_' || status
--   'provider_delivery_failed'
--   'reply_received'
--   'hard_bounce' / 'spam_complaint' / 'provider_suppression'
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- last_error is durable single-line outreach delivery failure / lifecycle
-- labels on service-only Mise sales outreach messages. It is not operator
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- last_error bytes a restored C-locale path would refuse — or the reverse —
-- breaking outreach message continuity across restore.
--
-- Scope:
--   - Attach outreach_messages_last_error_check as null OR
--     length(trim(last_error)) 1..80 PLUS ASCII control rejection under
--     COLLATE "C" (matches sibling error_code / last_error_code windows)
-- Does NOT rewrite outreach-agent / outreach-webhook Edge Functions,
-- subject (#638), body_html (#637), body_text (#636), personalization_note
-- (#635), provider_message_id (#470), status, generation_provider,
-- model_name, or idempotency_key. Leaves outreach_agent_runs.error_summary
-- for a separate tip.
-- Timestamp after MISE-005HW (#639).

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
        con.conname = 'outreach_messages_last_error_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%last_error%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%last_error%'
            or pg_get_constraintdef(con.oid) ilike '%char_length%btrim%last_error%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%subject%'
          and pg_get_constraintdef(con.oid) not ilike '%body_html%'
          and pg_get_constraintdef(con.oid) not ilike '%body_text%'
          and pg_get_constraintdef(con.oid) not ilike '%personalization_note%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%generation_provider%'
          and pg_get_constraintdef(con.oid) not ilike '%model_name%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%sequence_number%'
          and pg_get_constraintdef(con.oid) not ilike '%attempt_count%'
          and con.conname is distinct from 'outreach_messages_subject_check'
          and con.conname is distinct from 'outreach_messages_body_html_check'
          and con.conname is distinct from 'outreach_messages_body_text_check'
          and con.conname is distinct from 'outreach_messages_personalization_note_check'
          and con.conname is distinct from 'outreach_messages_provider_message_id_check'
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
  drop constraint if exists outreach_messages_last_error_check;

alter table public.outreach_messages
  add constraint outreach_messages_last_error_check check (
    last_error is null
    or (
      length(trim(last_error)) between 1 and 80
      and last_error collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint outreach_messages_last_error_check
  on public.outreach_messages is
  'MISE-005HX: outreach_messages last_error null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
