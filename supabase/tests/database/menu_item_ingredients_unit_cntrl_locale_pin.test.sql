-- MISE-005GJ: public.menu_item_ingredients.unit CHECK must keep its
-- exact length(trim) 1..40 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept unit bytes the restored
-- C-locale gate would refuse. Column is NOT NULL. Sibling menu_item_name
-- and quantity CHECKs stay on their separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_unit_check'
  ),
  'menu_item_ingredients_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_unit_check'
  ),
  'length\(trim\(unit\)\) between 1 and 40',
  'menu_item_ingredients unit CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.menu_item_ingredients'::regclass
      and conname = 'menu_item_ingredients_unit_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'menu_item_ingredients unit CHECK uses COLLATE C cntrl rejection'
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
  'quantity_used_per_sale CHECK still excludes unit cntrl'
);

select ok(
  (
    select coalesce(
      (
        select pg_get_constraintdef(oid)
        from pg_constraint
        where conrelid = 'public.menu_item_ingredients'::regclass
          and conname = 'menu_item_ingredients_menu_item_name_check'
      ),
      ''
    ) !~ 'unit'
  ),
  'menu_item_ingredients menu_item_name CHECK remains separate from unit on this tip'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('oz' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable recipe unit is accepted under COLLATE C'
);

select is(
  (E'o\tz' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in recipe unit is rejected under COLLATE C'
);

select is(
  (E'o\nz' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in recipe unit is rejected under COLLATE C'
);

select is(
  (E'o\u007fz' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in recipe unit is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('oz' collate "C" !~ '[[:cntrl:]]')
    and (E'o\tz' collate "C" ~ '[[:cntrl:]]')
    and (E'o\nz' collate "C" ~ '[[:cntrl:]]')
    and (E'o\u007fz' collate "C" ~ '[[:cntrl:]]'),
  true,
  'recipe unit control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'o\tz'),
      ('oz'),
      (E'o\nz'),
      (E'o\u007fz')
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
      and conname = 'menu_item_ingredients_unit_check'
  ),
  1::bigint,
  'exactly one menu_item_ingredients_unit_check constraint is attached'
);

select * from finish();
rollback;
