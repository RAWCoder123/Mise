-- MISE-005GF: public.menu_items.category CHECK must keep its exact
-- length(trim) 1..120 bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept category bytes the restored C-locale gate
-- would refuse. NULL remains allowed (column is nullable).
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_category_check'
  ),
  'menu_items_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_category_check'
  ),
  'length\(trim\(category\)\) between 1 and 120',
  'menu_items category CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_category_check'
  ),
  'category collate "C" !~ ''[[:cntrl:]]''',
  'menu_items category CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_recipe_authority_check'
  ),
  'menu_items_recipe_authority_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_recipe_authority_check'
  ) ilike '%[[:cntrl:]]%',
  false,
  'menu_items_recipe_authority_check still excludes category cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Appetizers' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable menu category is accepted under COLLATE C'
);

select is(
  (E'Appe\ttizers' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in menu category is rejected under COLLATE C'
);

select is(
  (E'Appe\ntizers' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in menu category is rejected under COLLATE C'
);

select is(
  (E'Appe\u007ftizers' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in menu category is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Appetizers' collate "C" !~ '[[:cntrl:]]')
    and (E'Appe\ttizers' collate "C" ~ '[[:cntrl:]]')
    and (E'Appe\ntizers' collate "C" ~ '[[:cntrl:]]')
    and (E'Appe\u007ftizers' collate "C" ~ '[[:cntrl:]]'),
  true,
  'menu category control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Appe\ttizers'),
      ('Appetizers'),
      (E'Appe\ntizers'),
      (E'Appe\u007ftizers')
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
    where conrelid = 'public.menu_items'::regclass
      and contype = 'c'
      and conname = 'menu_items_category_check'
  ),
  1::bigint,
  'exactly one menu_items_category_check constraint is attached'
);

select * from finish();
rollback;
