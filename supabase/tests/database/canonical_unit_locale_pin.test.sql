-- MISE-005CD: inventory_items / purchase_decision_events canonical_unit
-- CHECKs and verify writer must keep the exact-token allowlist and pin
-- ASCII shape under COLLATE "C" so dump/restore cannot accept a conversion
-- identity the restored C-locale gate would refuse.
begin;
select plan(18);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_check'
  ),
  'inventory_items_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'inventory_items canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'inventory_items canonical_unit CHECK uses COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.inventory_items'::regclass
      and conname = 'inventory_items_canonical_unit_check'
  ),
  'canonical_unit is null',
  'inventory_items canonical_unit CHECK keeps null-or draft shape'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_canonical_unit_check'
  ),
  'purchase_decision_events_canonical_unit_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_canonical_unit_check'
  ),
  'canonical_unit in \(''g'', ''ml'', ''each''\)',
  'purchase_decision canonical_unit CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_decision_events'::regclass
      and conname = 'purchase_decision_events_canonical_unit_check'
  ),
  'canonical_unit collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_decision canonical_unit CHECK uses COLLATE C'
);

select matches(
  pg_get_functiondef(
    'public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric)'::regprocedure
  ),
  'p_canonical_unit collate "C" !~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'verify_inventory_item_canonical_unit writer uses COLLATE C shape gate'
);

select matches(
  pg_get_functiondef(
    'public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric)'::regprocedure
  ),
  'p_canonical_unit not in \(''g'', ''ml'', ''each''\)',
  'verify_inventory_item_canonical_unit writer keeps exact allowlist'
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

select is(
  has_function_privilege(
    'authenticated',
    'public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric)',
    'EXECUTE'
  ),
  true,
  'authenticated EXECUTE on verify_inventory_item_canonical_unit is preserved'
);

select * from finish();
rollback;
