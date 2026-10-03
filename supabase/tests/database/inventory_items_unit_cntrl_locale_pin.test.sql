-- MISE-005FV: public.inventory_items.unit CHECK must keep its exact
-- length bound and pin ASCII control rejection under COLLATE "C" so
-- dump/restore cannot accept unit bytes the restored C-locale gate
-- would refuse. Preserves the MISE-005FU item_name cntrl pin on the
-- shared operational_values_check.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'inventory_items_operational_values_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'length\(trim\(unit\)\) between 1 and 40',
  'inventory_items unit CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'inventory_items unit CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'inventory_items item_name CHECK keeps MISE-005FU cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'length\(trim\(item_name\)\) between 1 and 160',
  'inventory_items item_name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'length\(trim\(supplier_name\)\) between 1 and 160',
  'inventory_items supplier_name CHECK keeps exact length bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('lb' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory unit is accepted under COLLATE C'
);

select is(
  (E'lb\t' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory unit is rejected under COLLATE C'
);

select is(
  (E'lb\n' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory unit is rejected under COLLATE C'
);

select is(
  (E'lb\u007f' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory unit is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('lb' collate "C" !~ '[[:cntrl:]]')
    and (E'lb\t' collate "C" ~ '[[:cntrl:]]')
    and (E'lb\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory unit control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'lb\t'),
      ('lb'),
      (E'lb\n'),
      (E'lb\u007f')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
