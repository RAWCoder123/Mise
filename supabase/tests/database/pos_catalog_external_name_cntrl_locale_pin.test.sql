-- MISE-005GH: public.pos_catalog_item_mappings.external_name CHECK must keep
-- its exact length(trim) 1..160 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept external_name bytes the restored
-- C-locale gate would refuse. Column is NOT NULL.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_name_check'
  ),
  'pos_catalog_item_mappings_external_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_name_check'
  ),
  'length\(trim\(external_name\)\) between 1 and 160',
  'external_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mappings_external_name_check'
  ),
  'external_name collate "C" !~ ''[[:cntrl:]]''',
  'external_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mapping_window_check'
  ),
  'pos_catalog_item_mapping_window_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and conname = 'pos_catalog_item_mapping_window_check'
  ) ilike '%[[:cntrl:]]%',
  false,
  'pos_catalog_item_mapping_window_check still excludes external_name cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Authority Burger' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable catalog external name is accepted under COLLATE C'
);

select is(
  (E'Authority\tBurger' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in catalog external name is rejected under COLLATE C'
);

select is(
  (E'Authority\nBurger' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in catalog external name is rejected under COLLATE C'
);

select is(
  (E'Authority\u007fBurger' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in catalog external name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Authority Burger' collate "C" !~ '[[:cntrl:]]')
    and (E'Authority\tBurger' collate "C" ~ '[[:cntrl:]]')
    and (E'Authority\nBurger' collate "C" ~ '[[:cntrl:]]')
    and (E'Authority\u007fBurger' collate "C" ~ '[[:cntrl:]]'),
  true,
  'catalog external name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Authority\tBurger'),
      ('Authority Burger'),
      (E'Authority\nBurger'),
      (E'Authority\u007fBurger')
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
    where conrelid = 'public.pos_catalog_item_mappings'::regclass
      and contype = 'c'
      and conname = 'pos_catalog_item_mappings_external_name_check'
  ),
  1::bigint,
  'exactly one pos_catalog_item_mappings_external_name_check constraint is attached'
);

select * from finish();
rollback;
