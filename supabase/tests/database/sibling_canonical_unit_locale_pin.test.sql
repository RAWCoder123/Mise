-- MISE-005CE: sibling canonical_unit CHECKs must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a conversion identity the restored C-locale gate would refuse.
begin;
select plan(27);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_canonical_unit_check'
  ),
  'inventory_events_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'inventory_events canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_events'::regclass
      and conname = 'inventory_events_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'inventory_events canonical_unit CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_canonical_unit_check'
  ),
  'recipe_ingredients_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'recipe_ingredients canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recipe_ingredients canonical_unit CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_canonical_unit_check'
  ),
  'modifier_recipe_adjustments_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'modifier_recipe_adjustments canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'modifier_recipe_adjustments canonical_unit CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_canonical_unit_check'
  ),
  'ingredient_substitutions_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'ingredient_substitutions canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ingredient_substitutions canonical_unit CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_canonical_unit_check'
  ),
  'supplier_items_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'supplier_items canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_items canonical_unit CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_canonical_unit_check'
  ),
  'canonical_unit is null',
  'supplier_items canonical_unit CHECK keeps null-or draft shape'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_canonical_unit_check'
  ),
  'supplier_delivery_items_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'supplier_delivery_items canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_delivery_items'::regclass
      and conname = 'supplier_delivery_items_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_delivery_items canonical_unit CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('g' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token g matches under COLLATE C'
);

select is(
  ('ml' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ml matches under COLLATE C'
);

select is(
  ('each' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token each matches under COLLATE C'
);

select is(
  ('ea ch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced canonical_unit token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty canonical_unit token is rejected under COLLATE C'
);

select is(
  ('each!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated canonical_unit token is rejected under COLLATE C'
);

select is(
  (E'ea\u00e7h' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII canonical_unit token is rejected under COLLATE C'
);

select is(
  ('g' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ml' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('each' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted canonical_unit tokens match under COLLATE C'
);

select * from finish();
rollback;
