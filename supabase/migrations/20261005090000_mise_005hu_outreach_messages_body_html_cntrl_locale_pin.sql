-- MISE-005HU: pin public.outreach_messages.body_html CHECK to
-- reject unsafe control characters under COLLATE "C", while allowing
-- multiline HTML body markup (LF/TAB/CR).
--
-- outreach_messages.body_html was declared as
--   body_html text not null
--     check (char_length(btrim(body_html)) between 1 and 12000)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs under COLLATE "C".
--
-- body_html is free-form HTML email body on service-only Mise sales
-- outreach messages. Generators emit multi-line markup, so this tip uses the
-- established multiline-aware ASCII control class from supplier-send
-- operator_note / order_message / personalization_note (#635) /
-- body_text (#636) / value_proposition (#634):
--   collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
-- allowing LF/TAB/CR while rejecting other C0 controls and DEL. If LC_CTYPE
-- drifted under a bare (or missing) cntrl gate, dump/restore could accept
-- body-html bytes a restored C-locale path would refuse — or the reverse —
-- breaking outreach message HTML body continuity across restore.
--
-- Scope:
--   - Reattach outreach_messages_body_html_check preserving the
--     exact char_length(btrim(body_html)) 1..12000 bound PLUS
--     multiline-aware ASCII control rejection under COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus subject, body_text
--     (#636 / MISE-005HT), personalization_note (#635 / MISE-005HS),
--     status (#519 / MISE-005DT), generation_provider, idempotency_key,
--     provider_message_id, and last_error
-- Does NOT rewrite outreach writers/Edge Functions, campaign value_proposition
-- / audience_description / company fields, lead business_name, or
-- restaurant-tenant tables.
-- Timestamp after MISE-005HT (#636).

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
        con.conname = 'outreach_messages_body_html_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%body_html%'
          and (
            pg_get_constraintdef(con.oid) ilike '%char_length%btrim%body_html%'
            or pg_get_constraintdef(con.oid) ilike '%length%trim%body_html%'
            or pg_get_constraintdef(con.oid) ilike E'%\\x00-\\x08%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%subject%'
          and pg_get_constraintdef(con.oid) not ilike '%body_text%'
          and pg_get_constraintdef(con.oid) not ilike '%personalization_note%'
          and pg_get_constraintdef(con.oid) not ilike '%generation_provider%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%provider_message_id%'
          and pg_get_constraintdef(con.oid) not ilike '%last_error%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and con.conname is distinct from 'outreach_messages_subject_check'
          and con.conname is distinct from 'outreach_messages_body_text_check'
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
  drop constraint if exists outreach_messages_body_html_check;

alter table public.outreach_messages
  add constraint outreach_messages_body_html_check check (
    char_length(btrim(body_html)) between 1 and 12000
    and body_html collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  );

comment on constraint outreach_messages_body_html_check
  on public.outreach_messages is
  'MISE-005HU: outreach_messages body_html char_length(btrim) 1..12000 plus multiline-aware ASCII control rejection under COLLATE "C" (allows LF/TAB/CR; rejects other C0 controls and DEL).';
