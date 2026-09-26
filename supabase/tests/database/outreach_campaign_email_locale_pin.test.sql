-- MISE-005M: outreach_campaigns sender_email / reply_to shape CHECKs must be
-- pinned to COLLATE "C" so restore cannot reject approved campaign rows the
-- source accepted when LC_CTYPE drifts on [[:space:]].
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_sender_email_check'
  ),
  'outreach_campaigns_sender_email_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_reply_to_check'
  ),
  'outreach_campaigns_reply_to_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_sender_email_check'
  ),
  'sender_email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'sender_email CHECK uses COLLATE C [[:space:]] rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_reply_to_check'
  ),
  'reply_to collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'reply_to CHECK uses COLLATE C [[:space:]] rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII whitespace.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'ops\t@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII tab breaks email shape under COLLATE C'
);

select is(
  ('ops@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'printable ASCII mailbox matches under COLLATE C'
);

select is(
  (E'ops\n@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII LF breaks email shape under COLLATE C'
);

select is(
  ('ops@mise.example' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'legacy ~* shape still accepts printable ASCII under database ctype'
);

select * from finish();
rollback;
