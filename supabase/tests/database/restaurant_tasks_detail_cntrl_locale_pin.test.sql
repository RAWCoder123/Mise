-- MISE-005EP: public.restaurant_tasks.detail CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept task-detail bytes the restored C-locale
-- gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_detail_check'
  ),
  'restaurant_tasks_detail_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_detail_check'
  ),
  'length\(trim\(detail\)\) between 1 and 2000',
  'restaurant_tasks detail CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_detail_check'
  ),
  'detail is null',
  'restaurant_tasks detail CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_detail_check'
  ),
  'detail collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_tasks detail CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Count the walk-in case before ordering.' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant task detail text is accepted under COLLATE C'
);

select is(
  (E'Count the walk-in\tcase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant task detail text is rejected under COLLATE C'
);

select is(
  (E'Count the walk-in\ncase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant task detail text is rejected under COLLATE C'
);

select is(
  (E'Count the walk-in\u007fcase' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant task detail text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Count the walk-in case before ordering.' collate "C" !~ '[[:cntrl:]]')
    and (E'Count the walk-in\tcase' collate "C" ~ '[[:cntrl:]]')
    and (E'Count the walk-in\u007fcase' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant task detail control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Count the walk-in\tcase'),
      ('Count the walk-in case before ordering.'),
      (E'Count the walk-in\ncase'),
      (E'Count the walk-in\u007fcase')
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
      and conname = 'restaurant_tasks_detail_check'
  ),
  'between 1 and 2000',
  'restaurant_tasks detail CHECK keeps original length window'
);

select * from finish();
rollback;
