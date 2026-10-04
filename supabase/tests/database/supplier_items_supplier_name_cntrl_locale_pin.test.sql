-- MISE-005GT: public.supplier_items.supplier_name CHECK must keep its
-- length(trim) 1..160 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept supplier_name bytes the
-- restored C-locale gate would refuse. Column is NOT NULL. Sibling
-- operational_values_check stays on its separate constraint.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_name_check'
  ),
  'supplier_items_supplier_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_name_check'
  ),
  'length\(trim\(supplier_name\)\) between 1 and 160',
  'supplier_items supplier_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_name_check'
  ),
  'supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'supplier_items supplier_name CHECK uses COLLATE C cntrl rejection'
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
  'supplier_items operational_values_check still excludes supplier_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Sysco Fresh' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable catalog supplier_name is accepted under COLLATE C'
);

select is(
  (E'Sysco\tFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in catalog supplier_name is rejected under COLLATE C'
);

select is(
  (E'Sysco\nFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in catalog supplier_name is rejected under COLLATE C'
);

select is(
  (E'Sysco\u007fFresh' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in catalog supplier_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Sysco Fresh' collate "C" !~ '[[:cntrl:]]')
    and (E'Sysco\tFresh' collate "C" ~ '[[:cntrl:]]')
    and (E'Sysco\nFresh' collate "C" ~ '[[:cntrl:]]')
    and (E'Sysco\u007fFresh' collate "C" ~ '[[:cntrl:]]'),
  true,
  'catalog supplier_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Sysco\tFresh'),
      ('Sysco Fresh'),
      (E'Sysco\nFresh'),
      (E'Sysco\u007fFresh')
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
      and conname = 'supplier_items_supplier_name_check'
  ),
  1::bigint,
  'exactly one supplier_items_supplier_name_check constraint is attached'
);

select * from finish();
rollback;
