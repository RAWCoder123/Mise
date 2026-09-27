-- MISE-005AL: purchase_lines currency shape CHECK must use COLLATE "C" so
-- dump/restore cannot accept a currency code the restaurant profile
-- currency contract (MISE-005AB) would refuse under C locale.
begin;
select plan(6);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_currency_check'
  ),
  'purchase_lines_currency_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_currency_check'
  ),
  'currency collate "C" ~ ''\^\[A-Z\]\{3\}\$''',
  'purchase_lines currency CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_lines'::regclass
      and conname = 'purchase_lines_currency_check'
  ),
  'currency is null',
  'purchase_lines currency CHECK preserves nullable currency'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII A–Z.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('USD' collate "C" ~ '^[A-Z]{3}$'),
  true,
  'ASCII uppercase ISO code matches under COLLATE C'
);

select is(
  ('usd' collate "C" ~ '^[A-Z]{3}$'),
  false,
  'lowercase currency code is rejected under COLLATE C'
);

select is(
  ('US1' collate "C" ~ '^[A-Z]{3}$'),
  false,
  'digit inside currency code is rejected under COLLATE C'
);

select * from finish();
rollback;
