-- MISE-005O: Gmail credentials sender_email CHECK + OAuth fail-closed must
-- be pinned to COLLATE "C" so restore/write paths cannot diverge on lower /
-- [[:cntrl:]] / [[:space:]].
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'gmail_credentials_sender_email_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'lower\(sender_email collate "C"\) collate "C"',
  'sender_email CHECK uses COLLATE C lower'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'sender_email collate "C" !~ ''[[:cntrl:]]''',
  'sender_email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.gmail_credentials'::regclass
      and conname = 'gmail_credentials_sender_email_check'
  ),
  'sender_email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'sender_email CHECK uses COLLATE C [[:space:]] shape'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'service_complete_gmail_oauth'
  ),
  'private.service_complete_gmail_oauth exists'
);

select matches(
  pg_get_functiondef(
    'private.service_complete_gmail_oauth(uuid,text,text,text,text[])'::regprocedure
  ),
  'btrim\(coalesce\(p_sender_email, ''''\)\) collate "C"',
  'OAuth lower/btrim sender_email uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_complete_gmail_oauth(uuid,text,text,text,text[])'::regprocedure
  ),
  'normalized_email collate "C" ~ ''[[:cntrl:]]''',
  'OAuth cntrl fail-closed uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'private.service_complete_gmail_oauth(uuid,text,text,text,text[])'::regprocedure
  ),
  'normalized_email collate "C" !~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'OAuth shape fail-closed uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII whitespace.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'orders\t@fresh.test' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII tab breaks email shape under COLLATE C'
);

select is(
  ('orders@fresh.test' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'printable ASCII mailbox matches under COLLATE C'
);

select * from finish();
rollback;
