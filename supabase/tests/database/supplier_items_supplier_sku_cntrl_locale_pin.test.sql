-- MISE-005GM: public.supplier_items.supplier_sku CHECK must keep its
-- null-or-length(trim) 1..64 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept supplier_sku bytes the
-- restored C-locale gate would refuse. Column is nullable. Sibling
-- operational_values_check stays on its separate constraint.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_sku_check'
  ),
  'supplier_items_supplier_sku_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_sku_check'
  ),
  'supplier_sku is null',
  'supplier_items supplier_sku CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_sku_check'
  ),
  'length\(trim\(supplier_sku\)\) between 1 and 64',
  'supplier_items supplier_sku CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_supplier_sku_check'
  ),
  'supplier_sku collate "C" !~ ''[[:cntrl:]]''',
  'supplier_items supplier_sku CHECK uses COLLATE C cntrl rejection'
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
  'supplier_items operational_values_check still excludes supplier_sku cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('SYS-TOMATO-CASE' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable vendor SKU is accepted under COLLATE C'
);

select is(
  (E'SYS\tTOMATO' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in vendor SKU is rejected under COLLATE C'
);

select is(
  (E'SYS\nTOMATO' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in vendor SKU is rejected under COLLATE C'
);

select is(
  (E'SYS\u007fTOMATO' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in vendor SKU is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('SYS-TOMATO-CASE' collate "C" !~ '[[:cntrl:]]')
    and (E'SYS\tTOMATO' collate "C" ~ '[[:cntrl:]]')
    and (E'SYS\nTOMATO' collate "C" ~ '[[:cntrl:]]')
    and (E'SYS\u007fTOMATO' collate "C" ~ '[[:cntrl:]]'),
  true,
  'vendor SKU control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'SYS\tTOMATO'),
      ('SYS-TOMATO-CASE'),
      (E'SYS\nTOMATO'),
      (E'SYS\u007fTOMATO')
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
      and conname = 'supplier_items_supplier_sku_check'
  ),
  1::bigint,
  'exactly one supplier_items_supplier_sku_check constraint is attached'
);

select * from finish();
rollback;
