-- MISE-005GO: public.supplier_items.pack_size CHECK must keep its
-- null-or-length(trim) 1..80 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept pack_size bytes the
-- restored C-locale gate would refuse. Column is nullable. Sibling
-- operational_values_check stays on its separate constraint.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_pack_size_check'
  ),
  'supplier_items_pack_size_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_pack_size_check'
  ),
  'pack_size is null',
  'supplier_items pack_size CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_pack_size_check'
  ),
  'length\(trim\(pack_size\)\) between 1 and 80',
  'supplier_items pack_size CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and conname = 'supplier_items_pack_size_check'
  ),
  'pack_size collate "C" !~ ''[[:cntrl:]]''',
  'supplier_items pack_size CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_operational_values_check'
  ),
  'supplier_items operational_values_check remains attached'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_operational_values_check'
    limit 1
  ) ilike '%[[:cntrl:]]%',
  false,
  'supplier_items operational_values_check still excludes pack_size cntrl'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('10 lb case' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable pack-size label is accepted under COLLATE C'
);

select is(
  (E'10\tlb case' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in pack-size label is rejected under COLLATE C'
);

select is(
  (E'10\nlb case' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in pack-size label is rejected under COLLATE C'
);

select is(
  (E'10\u007flb case' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in pack-size label is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('10 lb case' collate "C" !~ '[[:cntrl:]]')
    and (E'10\tlb case' collate "C" ~ '[[:cntrl:]]')
    and (E'10\nlb case' collate "C" ~ '[[:cntrl:]]')
    and (E'10\u007flb case' collate "C" ~ '[[:cntrl:]]'),
  true,
  'pack-size label control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'10\tlb case'),
      ('10 lb case'),
      (E'10\nlb case'),
      (E'10\u007flb case')
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
    where conrelid = 'public.supplier_items'::regclass
      and contype = 'c'
      and conname = 'supplier_items_pack_size_check'
  ),
  1::bigint,
  'exactly one supplier_items_pack_size_check constraint is attached'
);

select * from finish();
rollback;
