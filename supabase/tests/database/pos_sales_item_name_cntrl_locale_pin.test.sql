-- MISE-005GA: public.pos_sales.item_name CHECK must keep its exact
-- length bound and pin ASCII control rejection under COLLATE "C" so
-- dump/restore cannot accept item_name bytes the restored C-locale gate
-- would refuse. Category remains length-only on the shared CHECK.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'pos_sales_operational_values_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'length\(trim\(item_name\)\) between 1 and 200',
  'pos_sales item_name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'pos_sales item_name CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'length\(trim\(category\)\) between 1 and 120',
  'pos_sales category CHECK keeps exact length bound without cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'quantity_sold > 0',
  'pos_sales quantity_sold CHECK keeps exact positive bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ),
  'quantity_sold <= 100000',
  'pos_sales quantity_sold CHECK keeps exact upper bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Margherita Pizza' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable POS sale item_name is accepted under COLLATE C'
);

select is(
  (E'Margherita\tPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in POS sale item_name is rejected under COLLATE C'
);

select is(
  (E'Margherita\nPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in POS sale item_name is rejected under COLLATE C'
);

select is(
  (E'Margherita\u007fPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in POS sale item_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Margherita Pizza' collate "C" !~ '[[:cntrl:]]')
    and (E'Margherita\tPizza' collate "C" ~ '[[:cntrl:]]')
    and (E'Margherita\u007fPizza' collate "C" ~ '[[:cntrl:]]'),
  true,
  'POS sale item_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Margherita\tPizza'),
      ('Margherita Pizza'),
      (E'Margherita\nPizza'),
      (E'Margherita\u007fPizza')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select ok(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_sales'::regclass
      and conname = 'pos_sales_operational_values_check'
  ) !~ 'category collate "C"',
  'pos_sales category CHECK remains without cntrl pin on this tip'
);

select * from finish();
rollback;
