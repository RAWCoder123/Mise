-- MISE-005GL: public.modifier_recipe_adjustments.modifier_name CHECK must
-- keep its exact length(trim) 1..160 bound and pin ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept modifier_name bytes the
-- restored C-locale gate would refuse. Column is NOT NULL. Sibling
-- verification_status CHECK stays on its separate constraint.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_modifier_name_check'
  ),
  'modifier_recipe_adjustments_modifier_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_modifier_name_check'
  ),
  'length\(trim\(modifier_name\)\) between 1 and 160',
  'modifier_recipe_adjustments modifier_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_modifier_name_check'
  ),
  'modifier_name collate "C" !~ ''[[:cntrl:]]''',
  'modifier_recipe_adjustments modifier_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%verification_status%'
      and pg_get_constraintdef(oid) ilike '%verified%'
  ),
  'modifier_recipe_adjustments verification_status CHECK remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%verification_status%'
      and pg_get_constraintdef(oid) ilike '%verified%'
    limit 1
  ) ilike '%[[:cntrl:]]%',
  false,
  'modifier_recipe_adjustments verification_status CHECK still excludes modifier_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('No onion' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable POS modifier name is accepted under COLLATE C'
);

select is(
  (E'No\tonion' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in POS modifier name is rejected under COLLATE C'
);

select is(
  (E'No\nonion' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in POS modifier name is rejected under COLLATE C'
);

select is(
  (E'No\u007fonion' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in POS modifier name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('No onion' collate "C" !~ '[[:cntrl:]]')
    and (E'No\tonion' collate "C" ~ '[[:cntrl:]]')
    and (E'No\nonion' collate "C" ~ '[[:cntrl:]]')
    and (E'No\u007fonion' collate "C" ~ '[[:cntrl:]]'),
  true,
  'POS modifier name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'No\tonion'),
      ('No onion'),
      (E'No\nonion'),
      (E'No\u007fonion')
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
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and contype = 'c'
      and conname = 'modifier_recipe_adjustments_modifier_name_check'
  ),
  1::bigint,
  'exactly one modifier_recipe_adjustments_modifier_name_check constraint is attached'
);

select * from finish();
rollback;
