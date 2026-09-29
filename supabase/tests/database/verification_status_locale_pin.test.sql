-- MISE-005CG: verification_status CHECKs must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a review-state identity the restored C-locale gate would refuse.
begin;
select plan(27);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_verification_status_check'
  ),
  'pos_catalog_item_mappings_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_verification_status_check'
  ),
  'verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'pos_catalog_item_mappings verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_verification_status_check'
  ),
  'verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'pos_catalog_item_mappings verification_status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_verification_status_check'
  ),
  'recipe_ingredients_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_verification_status_check'
  ),
  'verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'recipe_ingredients verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_ingredients'::regclass
      and conname = 'recipe_ingredients_verification_status_check'
  ),
  'verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recipe_ingredients verification_status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_verification_status_check'
  ),
  'modifier_recipe_adjustments_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_verification_status_check'
  ),
  'verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'modifier_recipe_adjustments verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.modifier_recipe_adjustments'::regclass
      and conname = 'modifier_recipe_adjustments_verification_status_check'
  ),
  'verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'modifier_recipe_adjustments verification_status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_verification_status_check'
  ),
  'ingredient_substitutions_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_verification_status_check'
  ),
  'verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'ingredient_substitutions verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ingredient_substitutions'::regclass
      and conname = 'ingredient_substitutions_verification_status_check'
  ),
  'verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ingredient_substitutions verification_status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_verification_status_check'
  ),
  'supplier_items_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_verification_status_check'
  ),
  'verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'supplier_items verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_verification_status_check'
  ),
  'verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'supplier_items verification_status CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_verification_status_check'
  ),
  'inventory_items_canonical_unit_verification_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_verification_status_check'
  ),
  'canonical_unit_verification_status in \(''draft'', ''verified'', ''rejected'', ''expired''\)',
  'inventory_items canonical_unit_verification_status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_verification_status_check'
  ),
  'canonical_unit_verification_status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'inventory_items canonical_unit_verification_status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft matches under COLLATE C'
);

select is(
  ('verified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token verified matches under COLLATE C'
);

select is(
  ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token rejected matches under COLLATE C'
);

select is(
  ('expired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token expired matches under COLLATE C'
);

select is(
  ('ver ified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced verification_status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty verification_status token is rejected under COLLATE C'
);

select is(
  ('draft!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated verification_status token is rejected under COLLATE C'
);

select is(
  (E'verif\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII verification_status token is rejected under COLLATE C'
);

select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('verified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('rejected' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('expired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted verification_status tokens match under COLLATE C'
);

select * from finish();
rollback;
