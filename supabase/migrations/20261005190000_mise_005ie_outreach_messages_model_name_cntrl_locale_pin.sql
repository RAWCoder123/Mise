-- MISE-005IE: pin public.outreach_messages.model_name CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_messages.model_name was declared as nullable text with no length
-- or control-character gate. Current writers persist the OpenAI model id from
-- OPENAI_OUTREACH_MODEL (default 'gpt-5.6') or null for deterministic_fallback.
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE; this cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; sibling tips
-- re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- model_name is a durable single-line generation model label on service-only
-- Mise sales outreach messages. It is not operator free-form multiline prose
-- and must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or
-- missing) cntrl gate, dump/restore could accept model_name bytes a restored
-- C-locale path would refuse — or the reverse — breaking outreach message
-- continuity across restore.
--
-- Scope:
--   - Attach outreach_messages_model_name_check as null OR
--     length(trim(model_name)) 1..80 PLUS ASCII control rejection under
--     COLLATE "C" (matches sibling last_error / error_code windows)
-- Does NOT rewrite outreach-agent Edge Function writers, subject (#638),
-- body_html (#637), body_text (#636), personalization_note (#635),
-- last_error (#640), provider_message_id (#470), status, generation_provider
-- (#525), or idempotency_key.
-- Timestamp after MISE-005ID (#646).

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
        con.conname = 'outreach_messages_model_name_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%model_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%model_name%'
            or pg_get_constraintdef(con.oid) ilike '%char_length%btrim%model_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%subject%'
          and pg_get_constraintdef(con.oid) not ilike '%body_html%'
          and pg_get_constraintdef(con.oid) not ilike '%body_text%'
          and pg_get_constraintdef(con.oid) not ilike '%personalization_note%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%generation_provider%'
          and pg_get_constraintdef(con.oid) not ilike '%last_error%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%sequence_number%'
          and pg_get_constraintdef(con.oid) not ilike '%attempt_count%'
          and con.conname is distinct from 'outreach_messages_subject_check'
          and con.conname is distinct from 'outreach_messages_body_html_check'
          and con.conname is distinct from 'outreach_messages_body_text_check'
          and con.conname is distinct from 'outreach_messages_personalization_note_check'
          and con.conname is distinct from 'outreach_messages_provider_message_id_check'
          and con.conname is distinct from 'outreach_messages_last_error_check'
          and con.conname is distinct from 'outreach_messages_generation_provider_check'
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
  drop constraint if exists outreach_messages_model_name_check;

alter table public.outreach_messages
  add constraint outreach_messages_model_name_check check (
    model_name is null
    or (
      length(trim(model_name)) between 1 and 80
      and model_name collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint outreach_messages_model_name_check
  on public.outreach_messages is
  'MISE-005IE: outreach_messages model_name null or length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
