-- MISE-005IK: public.restaurant_email_connections.sender_email CHECK must
-- keep nullability and pin the durable Gmail From mailbox shape under
-- COLLATE "C" so dump/restore cannot accept display From bytes the
-- restored C-locale credential gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'restaurant_email_connections_sender_email_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'sender_email is null',
  'restaurant_email_connections sender_email CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'length\(sender_email\) between 3 and 254',
  'restaurant_email_connections sender_email CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'sender_email collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_email_connections sender_email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'sender_email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'restaurant_email_connections sender_email CHECK uses COLLATE C mailbox shape'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls and
-- space. Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('chef@example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and 'chef@example.com' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable mailbox sender_email is accepted under COLLATE C'
);

select is(
  (E'chef\t@example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'tab in sender_email local-part is rejected under COLLATE C'
);

select is(
  (E'chef@exam\nple.com' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in sender_email domain is rejected under COLLATE C'
);

select is(
  (E'chef@exam\u0000ple.com' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in sender_email domain is rejected under COLLATE C'
);

select is(
  ('chef @example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'space in sender_email local-part is rejected under COLLATE C'
);

select is(
  ('Chef@Example.com' = pg_catalog.lower('Chef@Example.com' collate "C") collate "C"),
  false,
  'mixed-case sender_email fails C-locale lower equality'
);

select is(
  ('chef@example.com' collate "C" !~ '[[:cntrl:]]')
    and (E'chef\t@example.com' collate "C" ~ '[[:cntrl:]]'
      or E'chef\t@example.com' collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    and (E'chef@exam\nple.com' collate "C" ~ '[[:cntrl:]]')
    and ('chef @example.com' collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'sender_email control and space detectors match ASCII C classes'
);

select is(
  (
    select count(*)
    from (values
      (E'chef\t@example.com'),
      ('chef@example.com'),
      (E'chef@exam\nple.com'),
      ('chef @example.com')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_email_connections'::regclass
      and conname = 'restaurant_email_connections_sender_email_check'
  ),
  'between 3 and 254',
  'restaurant_email_connections sender_email CHECK keeps original length window'
);

select * from finish();
rollback;
