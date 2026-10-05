-- MISE-005IF: outreach_suppressions.email shape CHECK must be pinned to
-- COLLATE "C" so restore cannot accept suppression mailboxes that sibling
-- lead/campaign email gates would refuse when LC_CTYPE drifts on [[:space:]].
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_email_check'
  ),
  'outreach_suppressions_email_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_email_check'
  ),
  'email collate "C" ~',
  'suppressions email CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_suppressions'::regclass
      and conname = 'outreach_suppressions_email_check'
  ),
  'email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'suppressions email CHECK uses COLLATE C [[:space:]] rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII whitespace.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'ops\t@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII tab breaks suppressions email shape under COLLATE C'
);

select is(
  ('ops@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'printable ASCII mailbox matches under COLLATE C'
);

select is(
  (E'ops\n@mise.example' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII LF breaks suppressions email shape under COLLATE C'
);

select is(
  ('ops mise@example.test' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII space breaks suppressions email shape under COLLATE C'
);

select is(
  (
    select count(*)
    from (values
      (E'ops\t@mise.example'),
      ('ops@mise.example'),
      (E'ops\n@mise.example'),
      ('ops mise@example.test')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  0::bigint,
  'ASCII email shape detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
