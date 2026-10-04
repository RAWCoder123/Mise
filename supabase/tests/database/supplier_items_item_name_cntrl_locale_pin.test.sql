-- MISE-005GR: public.supplier_items.item_name CHECK must keep its
-- length(trim) 1..160 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept item_name bytes the
-- restored C-locale gate would refuse. Column is NOT NULL. Sibling
-- operational_values_check stays on its separate constraint.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_item_name_check'
  ),
  'supplier_items_item_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_item_name_check'
  ),
  'length\(trim\(item_name\)\) between 1 and 160',
  'supplier_items item_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_item_name_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'supplier_items item_name CHECK uses COLLATE C cntrl rejection'
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
  'supplier_items operational_values_check still excludes item_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Roma Tomatoes' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable catalog item_name is accepted under COLLATE C'
);

select is(
  (E'Roma\tTomatoes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in catalog item_name is rejected under COLLATE C'
);

select is(
  (E'Roma\nTomatoes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in catalog item_name is rejected under COLLATE C'
);

select is(
  (E'Roma\u007fTomatoes' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in catalog item_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Roma Tomatoes' collate "C" !~ '[[:cntrl:]]')
    and (E'Roma\tTomatoes' collate "C" ~ '[[:cntrl:]]')
    and (E'Roma\nTomatoes' collate "C" ~ '[[:cntrl:]]')
    and (E'Roma\u007fTomatoes' collate "C" ~ '[[:cntrl:]]'),
  true,
  'catalog item_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Roma\tTomatoes'),
      ('Roma Tomatoes'),
      (E'Roma\nTomatoes'),
      (E'Roma\u007fTomatoes')
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
      and conname = 'supplier_items_item_name_check'
  ),
  1::bigint,
  'exactly one supplier_items_item_name_check constraint is attached'
);

select * from finish();
rollback;
