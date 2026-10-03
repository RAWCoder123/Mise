-- MISE-005GE: public.inventory_items.category CHECK must keep its exact
-- length(trim) 1..120 bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept category bytes the restored C-locale gate
-- would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_category_check'
  ),
  'inventory_items_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_category_check'
  ),
  'length\(trim\(category\)\) between 1 and 120',
  'inventory_items category CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_category_check'
  ),
  'category collate "C" !~ ''[[:cntrl:]]''',
  'inventory_items category CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ),
  'inventory_items_operational_values_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_operational_values_check'
  ) ilike '%category%',
  false,
  'inventory_items_operational_values_check still excludes category'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Protein' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable inventory category is accepted under COLLATE C'
);

select is(
  (E'Pro\ttein' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in inventory category is rejected under COLLATE C'
);

select is(
  (E'Pro\ntein' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in inventory category is rejected under COLLATE C'
);

select is(
  (E'Pro\u007ftein' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in inventory category is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Protein' collate "C" !~ '[[:cntrl:]]')
    and (E'Pro\ttein' collate "C" ~ '[[:cntrl:]]')
    and (E'Pro\ntein' collate "C" ~ '[[:cntrl:]]')
    and (E'Pro\u007ftein' collate "C" ~ '[[:cntrl:]]'),
  true,
  'inventory category control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Pro\ttein'),
      ('Protein'),
      (E'Pro\ntein'),
      (E'Pro\u007ftein')
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
    where conrelid = 'public.inventory_items'::regclass
      and contype = 'c'
      and conname = 'inventory_items_category_check'
  ),
  1::bigint,
  'exactly one inventory_items_category_check constraint is attached'
);

select * from finish();
rollback;
