-- MISE-005ET: public.restaurant_tasks.related_supplier_name CHECK must keep
-- its exact null-or-length(trim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept related-supplier bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_supplier_bound_check'
  ),
  'restaurant_tasks_supplier_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_supplier_bound_check'
  ),
  'length\(trim\(related_supplier_name\)\) between 1 and 200',
  'restaurant_tasks related_supplier_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_supplier_bound_check'
  ),
  'related_supplier_name collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_tasks related_supplier_name CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Regional Protein Co' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable related supplier name is accepted under COLLATE C'
);

select is(
  (E'Regional\tProtein Co' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in related supplier name is rejected under COLLATE C'
);

select is(
  (E'Regional\nProtein Co' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in related supplier name is rejected under COLLATE C'
);

select is(
  (E'Regional\u0000Protein Co' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in related supplier name is rejected under COLLATE C'
);

select is(
  (E'Regional\u007fProtein Co' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in related supplier name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Regional Protein Co' collate "C" !~ '[[:cntrl:]]')
    and (E'Regional\tProtein Co' collate "C" ~ '[[:cntrl:]]')
    and (E'Regional\nProtein Co' collate "C" ~ '[[:cntrl:]]')
    and (E'Regional\u007fProtein Co' collate "C" ~ '[[:cntrl:]]'),
  true,
  'related supplier name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Regional\tProtein Co'),
      ('Regional Protein Co'),
      (E'Regional\nProtein Co'),
      (E'Regional\u007fProtein Co')
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
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_supplier_bound_check'
  ),
  'between 1 and 200',
  'restaurant_tasks related_supplier_name CHECK keeps original length window'
);

select * from finish();
rollback;
