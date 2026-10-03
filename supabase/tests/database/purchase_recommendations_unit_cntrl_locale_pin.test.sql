-- MISE-005FZ: public.purchase_recommendations.unit CHECK must keep
-- its exact length bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept unit bytes the restored C-locale gate
-- would refuse. Preserves the MISE-005FX item_name and MISE-005FY
-- supplier_name cntrl pins on the shared operational_values_check.
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'purchase_recommendations_operational_values_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(unit\)\) between 1 and 40',
  'purchase_recommendations unit CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'unit collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations unit CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'item_name collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations item_name CHECK keeps MISE-005FX cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'purchase_recommendations supplier_name CHECK keeps MISE-005FY cntrl pin'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(item_name\)\) between 1 and 160',
  'purchase_recommendations item_name CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(supplier_name\)\) between 1 and 160',
  'purchase_recommendations supplier_name CHECK keeps exact length bound'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('case' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable purchase recommendation unit is accepted under COLLATE C'
);

select is(
  (E'ca\tse' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in purchase recommendation unit is rejected under COLLATE C'
);

select is(
  (E'ca\nse' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in purchase recommendation unit is rejected under COLLATE C'
);

select is(
  (E'ca\u007fse' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in purchase recommendation unit is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('case' collate "C" !~ '[[:cntrl:]]')
    and (E'ca\tse' collate "C" ~ '[[:cntrl:]]')
    and (E'ca\u007fse' collate "C" ~ '[[:cntrl:]]'),
  true,
  'purchase recommendation unit control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'ca\tse'),
      ('case'),
      (E'ca\nse'),
      (E'ca\u007fse')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_operational_values_check'
  ),
  'length\(trim\(reason\)\) between 1 and 2000',
  'purchase_recommendations reason CHECK keeps exact length bound without cntrl pin'
);

select * from finish();
rollback;
