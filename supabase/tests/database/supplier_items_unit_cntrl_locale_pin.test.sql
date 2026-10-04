-- MISE-005GS: public.supplier_items.unit CHECK must keep its
-- length(trim) 1..40 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept unit bytes the
-- restored C-locale gate would refuse. Column is NOT NULL. Sibling
-- operational_values_check stays on its separate constraint.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_unit_check'
  ),
  'supplier_items_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_unit_check'
  ),
  'length\(trim\(unit\)\) between 1 and 40',
  'supplier_items unit CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_unit_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'supplier_items unit CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_operational_values_check'
  ),
  'supplier_items operational_values_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_operational_values_check'
    limit 1
  ) ilike '%[[:cntrl:]]%',
  false,
  'supplier_items operational_values_check still excludes unit cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('lb' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable catalog unit is accepted under COLLATE C'
);

select is(
  (E'lb\tcase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in catalog unit is rejected under COLLATE C'
);

select is(
  (E'lb\ncase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in catalog unit is rejected under COLLATE C'
);

select is(
  (E'lb\u007fcase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in catalog unit is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('lb' collate "C" !~ '[[:cntrl:]]')
    and (E'lb\tcase' collate "C" ~ '[[:cntrl:]]')
    and (E'lb\ncase' collate "C" ~ '[[:cntrl:]]')
    and (E'lb\u007fcase' collate "C" ~ '[[:cntrl:]]'),
  true,
  'catalog unit control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'lb\tcase'),
      ('lb'),
      (E'lb\ncase'),
      (E'lb\u007fcase')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_unit_check'
  ),
  1::bigint,
  'exactly one supplier_items_unit_check constraint is attached'
);

select * from finish();
rollback;
