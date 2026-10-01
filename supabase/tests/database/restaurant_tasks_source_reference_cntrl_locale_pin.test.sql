-- MISE-005EU: public.restaurant_tasks.source_reference CHECK must keep
-- its exact null-or-length(trim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept source-reference bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_source_reference_bound_check'
  ),
  'restaurant_tasks_source_reference_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_source_reference_bound_check'
  ),
  'length\(trim\(source_reference\)\) between 1 and 240',
  'restaurant_tasks source_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_source_reference_bound_check'
  ),
  'source_reference collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_tasks source_reference CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('inventory-risk:item-1' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable source reference is accepted under COLLATE C'
);

select is(
  (E'inventory-risk:\titem-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in source reference is rejected under COLLATE C'
);

select is(
  (E'inventory-risk:\nitem-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in source reference is rejected under COLLATE C'
);

select is(
  (E'inventory-risk:\u0000item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in source reference is rejected under COLLATE C'
);

select is(
  (E'inventory-risk:\u007fitem-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in source reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('inventory-risk:item-1' collate "C" !~ '[[:cntrl:]]')
    and (E'inventory-risk:\titem-1' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory-risk:\nitem-1' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory-risk:\u007fitem-1' collate "C" ~ '[[:cntrl:]]'),
  true,
  'source reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'inventory-risk:\titem-1'),
      ('inventory-risk:item-1'),
      (E'inventory-risk:\nitem-1'),
      (E'inventory-risk:\u007fitem-1')
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
      and conname = 'restaurant_tasks_source_reference_bound_check'
  ),
  'between 1 and 240',
  'restaurant_tasks source_reference CHECK keeps original length window'
);

select * from finish();
rollback;
