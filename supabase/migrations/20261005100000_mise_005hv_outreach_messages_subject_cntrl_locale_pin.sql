-- MISE-005HV: pin public.outreach_messages.subject CHECK to reject
-- control characters under COLLATE "C".
--
-- outreach_messages.subject was declared as
--   subject text not null
--     check (char_length(btrim(subject)) between 1 and 78)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- subject is a durable single-line email subject on service-only Mise sales
-- outreach messages. It is not operator free-form multiline prose and must not
-- accept LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl
-- gate, dump/restore could accept subject bytes a restored C-locale path
-- would refuse — or the reverse — breaking outreach message subject continuity
-- across restore.
--
-- Scope:
--   - Reattach outreach_messages_subject_check preserving the exact
--     char_length(btrim(subject)) 1..78 bound PLUS ASCII control rejection
--     under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus body_text (#636),
--     body_html (#637), personalization_note (#635), status (#519 /
--     MISE-005DT), generation_provider, idempotency_key, provider_message_id,
--     and last_error
-- Does NOT rewrite outreach writers/Edge Functions, campaign name /
-- company fields, lead business_name, or restaurant-tenant tables.
-- Timestamp after MISE-005HU (#637).

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
        con.conname = 'outreach_messages_subject_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%subject%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%subject%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%subject%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%body_text%'
          and pg_get_constraintdef(con.oid) not ilike '%body_html%'
          and pg_get_constraintdef(con.oid) not ilike '%personalization_note%'
          and pg_get_constraintdef(con.oid) not ilike '%generation_provider%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%last_error%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'outreach_messages_body_text_check'
          and con.conname is distinct from 'outreach_messages_body_html_check'
          and con.conname is distinct from 'outreach_messages_personalization_note_check'
          and con.conname is distinct from 'outreach_messages_status_check'
          and con.conname is distinct from 'outreach_messages_generation_provider_check'
          and con.conname is distinct from 'outreach_message_approval_timestamp'
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
  drop constraint if exists outreach_messages_subject_check;

alter table public.outreach_messages
  add constraint outreach_messages_subject_check check (
    char_length(btrim(subject)) between 1 and 78
    and subject collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint outreach_messages_subject_check
  on public.outreach_messages is
  'MISE-005HV: outreach_messages subject char_length(btrim) 1..78 plus ASCII control rejection under COLLATE "C".';
