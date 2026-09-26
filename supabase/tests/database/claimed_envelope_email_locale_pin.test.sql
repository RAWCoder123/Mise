-- MISE-005P: claimed_from / claimed_to on supplier_email_deliveries metadata
-- CHECK must be pinned to COLLATE "C" lower + [[:space:]] mailbox shape so
-- restore/write paths cannot diverge on lower / [[:cntrl:]] / [[:space:]].
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'supplier_email_deliveries_mise_003c_metadata_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'lower\(claimed_from collate "C"\) collate "C"',
  'claimed_from CHECK uses COLLATE C lower'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'lower\(claimed_to collate "C"\) collate "C"',
  'claimed_to CHECK uses COLLATE C lower'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_from collate "C" !~ ''[[:cntrl:]]''',
  'claimed_from CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_to collate "C" !~ ''[[:cntrl:]]''',
  'claimed_to CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_from collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'claimed_from CHECK uses COLLATE C [[:space:]] shape'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_to collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'claimed_to CHECK uses COLLATE C [[:space:]] shape'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'private.supplier_email_deliveries'::regclass
      and conname = 'supplier_email_deliveries_mise_003c_metadata_check'
  ),
  'claimed_subject collate "C" !~ ''[[:cntrl:]]''',
  'claimed_subject CHECK keeps COLLATE C cntrl rejection'
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
