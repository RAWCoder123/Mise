-- MISE-005GI: public.menu_item_ingredients.menu_item_name CHECK must keep its
-- exact length(trim) 1..200 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept menu_item_name bytes the restored
-- C-locale gate would refuse. Column is NOT NULL.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_menu_item_name_check'
  ),
  'menu_item_ingredients_menu_item_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_menu_item_name_check'
  ),
  'length\(trim\(menu_item_name\)\) between 1 and 200',
  'menu_item_ingredients menu_item_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_menu_item_name_check'
  ),
  'menu_item_name collate "C" !~ ''[[:cntrl:]]''',
  'menu_item_ingredients menu_item_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_quantity_used_per_sale_check'
  ),
  'menu_item_ingredients_quantity_used_per_sale_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_quantity_used_per_sale_check'
  ) ilike '%[[:cntrl:]]%',
  false,
  'quantity_used_per_sale CHECK still excludes menu_item_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Margherita Pizza' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable recipe menu item name is accepted under COLLATE C'
);

select is(
  (E'Margherita\tPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in recipe menu item name is rejected under COLLATE C'
);

select is(
  (E'Margherita\nPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in recipe menu item name is rejected under COLLATE C'
);

select is(
  (E'Margherita\u007fPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in recipe menu item name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Margherita Pizza' collate "C" !~ '[[:cntrl:]]')
    and (E'Margherita\tPizza' collate "C" ~ '[[:cntrl:]]')
    and (E'Margherita\nPizza' collate "C" ~ '[[:cntrl:]]')
    and (E'Margherita\u007fPizza' collate "C" ~ '[[:cntrl:]]'),
  true,
  'recipe menu item name control detector matches ASCII C [[:cntrl:]]'
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

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and contype = 'c'
      and conname = 'menu_item_ingredients_menu_item_name_check'
  ),
  1::bigint,
  'exactly one menu_item_ingredients_menu_item_name_check constraint is attached'
);

select * from finish();
rollback;
