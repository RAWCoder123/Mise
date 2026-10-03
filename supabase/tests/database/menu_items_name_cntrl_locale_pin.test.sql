-- MISE-005GG: public.menu_items.name CHECK must keep its exact
-- length(trim) 1..200 bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept name bytes the restored C-locale gate
-- would refuse. Column is NOT NULL.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_name_check'
  ),
  'menu_items_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_name_check'
  ),
  'length\(trim\(name\)\) between 1 and 200',
  'menu_items name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_items'::regclass
      and conname = 'menu_items_name_check'
  ),
  'name collate "C" !~ ''[[:cntrl:]]''',
  'menu_items name CHECK uses COLLATE C cntrl rejection'
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
  'menu_items_recipe_authority_check still excludes name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Margherita Pizza' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable menu name is accepted under COLLATE C'
);

select is(
  (E'Margherita\tPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in menu name is rejected under COLLATE C'
);

select is(
  (E'Margherita\nPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in menu name is rejected under COLLATE C'
);

select is(
  (E'Margherita\u007fPizza' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in menu name is rejected under COLLATE C'
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
  'menu name control detector matches ASCII C [[:cntrl:]]'
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
    where conrelid = 'public.menu_items'::regclass
      and contype = 'c'
      and conname = 'menu_items_name_check'
  ),
  1::bigint,
  'exactly one menu_items_name_check constraint is attached'
);

select * from finish();
rollback;
