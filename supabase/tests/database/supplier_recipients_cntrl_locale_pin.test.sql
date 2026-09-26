-- MISE-005K: supplier_recipients name/email cntrl CHECKs must be pinned to
-- COLLATE "C" so restore cannot reject recipient rows the source accepted.
begin;
select plan(10);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_name_bounds_check'
  ),
  'supplier_recipients_name_bounds_check exists'
);

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
      and conname = 'supplier_recipients_name_bounds_check'
  ),
  'supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'supplier_recipients.supplier_name CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'email collate "C" !~ ''[[:cntrl:]]''',
  'supplier_recipients.email CHECK uses COLLATE C cntrl rejection'
);

-- Preserve the rest of the bounds contract (length / trim / email shape).
select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_name_bounds_check'
  ),
  'between 1 and 160',
  'supplier_name CHECK still enforces length 1–160'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  '\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\.\[\^@\[:space:\]\]\+\$',
  'email CHECK still enforces basic address shape'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'Fresh\tFoods' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('Fresh Foods' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable supplier name is not a control under COLLATE C'
);

select is(
  (E'orders\u007f@fresh.test' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select is(
  ('orders@fresh.test' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable email is not a control under COLLATE C'
);

select * from finish();
rollback;
