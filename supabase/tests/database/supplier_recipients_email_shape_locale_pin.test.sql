-- MISE-005IU: supplier_recipients.email shape CHECK must pin [[:space:]]
-- rejection under COLLATE "C" (and keep ASCII C cntrl) so dump/restore cannot
-- accept To-mailboxes a restored C-locale path would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'supplier_recipients_email_format_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'length\(email\) between 3 and 254',
  'recipients email CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'email = .*btrim\(email\)',
  'recipients email CHECK requires trimmed storage'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'email collate "C" !~ ''[[:cntrl:]]''',
  'recipients email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'email collate "C" ~ ''\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$''',
  'recipients email CHECK uses COLLATE C mailbox shape'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls and
-- space. Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('orders@fresh.test' collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and 'orders@fresh.test' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable mailbox recipient email is accepted under COLLATE C'
);

select is(
  (E'orders\t@fresh.test' collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  false,
  'tab in recipient email local-part is rejected under COLLATE C'
);

select is(
  (E'orders@fre\nsh.test' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in recipient email domain is rejected under COLLATE C'
);

select is(
  (E'orders@fre\u0000sh.test' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in recipient email domain is rejected under COLLATE C'
);

select is(
  ('orders @fresh.test' collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  false,
  'space in recipient email local-part is rejected under COLLATE C'
);

select is(
  ('orders@fresh.test' collate "C" !~ '[[:cntrl:]]')
    and (E'orders\t@fresh.test' collate "C" ~ '[[:cntrl:]]'
      or E'orders\t@fresh.test' collate "C" !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    and (E'orders@fre\nsh.test' collate "C" ~ '[[:cntrl:]]')
    and ('orders @fresh.test' collate "C" !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  true,
  'recipient email control and space detectors match ASCII C classes'
);

select is(
  (
    select count(*)
    from (values
      ('orders@fresh.test'),
      (E'orders\t@fresh.test'),
      (E'orders@fre\nsh.test'),
      ('orders @fresh.test')
    ) fixture(sample)
    where (
      (fixture.sample collate "C" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        and fixture.sample collate "C" !~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        and fixture.sample collate "en_US.utf8" !~ '[[:cntrl:]]')
    )
  ),
  0::bigint,
  'ASCII recipient email detectors are identical under C and under the database ctype'
);

select * from finish();
rollback;
