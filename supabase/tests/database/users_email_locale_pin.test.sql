-- MISE-005IM: public.users.email CHECK must keep the auth mailbox length
-- bound and pin ASCII control + space rejection under COLLATE "C" so
-- dump/restore cannot accept profile mailbox bytes the restored C-locale
-- gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'users_email_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'length\(email\) between 3 and 254',
  'users email CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'email = .*btrim\(email\)',
  'users email CHECK requires trimmed storage'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'email collate "C" !~ ''[[:cntrl:]]''',
  'users email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'users email CHECK uses COLLATE C mailbox shape'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls and
-- space. Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('chef@example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and 'chef@example.com' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable mailbox profile email is accepted under COLLATE C'
);

select is(
  (E'chef\t@example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'tab in profile email local-part is rejected under COLLATE C'
);

select is(
  (E'chef@exam\nple.com' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in profile email domain is rejected under COLLATE C'
);

select is(
  (E'chef@exam\u0000ple.com' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in profile email domain is rejected under COLLATE C'
);

select is(
  ('chef @example.com' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'space in profile email local-part is rejected under COLLATE C'
);

select is(
  ('chef@example.com' collate "C" !~ '[[:cntrl:]]')
    and (E'chef\t@example.com' collate "C" ~ '[[:cntrl:]]'
      or E'chef\t@example.com' collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    and (E'chef@exam\nple.com' collate "C" ~ '[[:cntrl:]]')
    and ('chef @example.com' collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  true,
  'profile email control and space detectors match ASCII C classes'
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
    where conrelid = 'public.users'::regclass
      and conname = 'users_email_check'
  ),
  'between 3 and 254',
  'users email CHECK keeps original length window'
);

select * from finish();
rollback;
