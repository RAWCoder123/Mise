-- MISE-005N: supplier_recipients email shape CHECK + upsert fail-closed must
-- be pinned to COLLATE "C" so restore/write paths cannot diverge on [[:space:]].
begin;
select plan(10);

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
  'email collate "C" !~ ''[[:cntrl:]]''',
  'email CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_recipients'::regclass
      and conname = 'supplier_recipients_email_format_check'
  ),
  'email collate "C" ~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'email CHECK uses COLLATE C [[:space:]] shape'
);

select ok(
  exists (
    select 1
    from pg_proc
    where proname = 'upsert_supplier_recipient'
      and pg_function_is_visible(oid)
  ),
  'upsert_supplier_recipient exists'
);

select matches(
  pg_get_functiondef('public.upsert_supplier_recipient(uuid,uuid,text)'::regprocedure),
  'btrim\(coalesce\(p_email, ''''\)\) collate "C"',
  'upsert lower/btrim email uses COLLATE C'
);

select matches(
  pg_get_functiondef('public.upsert_supplier_recipient(uuid,uuid,text)'::regprocedure),
  'normalized_email collate "C" ~ ''[[:cntrl:]]''',
  'upsert cntrl fail-closed uses COLLATE C'
);

select matches(
  pg_get_functiondef('public.upsert_supplier_recipient(uuid,uuid,text)'::regprocedure),
  'normalized_email collate "C" !~ ''\^\[\^\[:space:\]@\]\+@\[\^\[:space:\]@\]\+\\\.\[\^\[:space:\]@\]\+\$''',
  'upsert shape fail-closed uses COLLATE C'
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

select is(
  (E'orders\n@fresh.test' collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  false,
  'ASCII LF breaks email shape under COLLATE C'
);

select * from finish();
rollback;
