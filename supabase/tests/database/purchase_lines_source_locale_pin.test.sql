-- MISE-005DN: purchase_lines.source CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a document-source token the restored
-- C-locale gate would refuse.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_source_check'
  ),
  'purchase_lines_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_source_check'
  ),
  'source in \(''invoice'', ''order_confirmation'', ''manual_entry'', ''credit_memo''\)',
  'purchase_lines source CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_source_check'
  ),
  'source collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_lines source CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('invoice' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token invoice matches under COLLATE C'
);

select is(
  ('order_confirmation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token order_confirmation matches under COLLATE C'
);

select is(
  ('manual_entry' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manual_entry matches under COLLATE C'
);

select is(
  ('credit_memo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token credit_memo matches under COLLATE C'
);

select is(
  ('order confirmation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced source token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty source token is rejected under COLLATE C'
);

select is(
  ('invoice!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated source token is rejected under COLLATE C'
);

select is(
  (E'invo\u00efce' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII source token is rejected under COLLATE C'
);

select is(
  ('invoice' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('order_confirmation' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manual_entry' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('credit_memo' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted source tokens match under COLLATE C'
);

select is(
  ('Invoice' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'ASCII-shaped Invoice passes shape gate alone under COLLATE C'
);

select is(
  ('INVOICE' in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo')),
  false,
  'case-shifted INVOICE fails exact allowlist'
);

select is(
  ('invoice ' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'trailing-space source token is rejected under COLLATE C'
);

select * from finish();
rollback;
