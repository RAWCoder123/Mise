-- MISE-005ER: public.restaurant_tasks.title CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C" so
-- dump/restore cannot accept task-title bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_title_check'
  ),
  'restaurant_tasks_title_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_title_check'
  ),
  'length\(trim\(title\)\) between 1 and 160',
  'restaurant_tasks title CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_title_check'
  ),
  'title collate "C" !~ ''[[:cntrl:]]''',
  'restaurant_tasks title CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Confirm chicken count' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable restaurant task title is accepted under COLLATE C'
);

select is(
  (E'Confirm\tchicken count' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in restaurant task title is rejected under COLLATE C'
);

select is(
  (E'Confirm\nchicken count' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in restaurant task title is rejected under COLLATE C'
);

select is(
  (E'Confirm\u0000chicken count' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in restaurant task title is rejected under COLLATE C'
);

select is(
  (E'Confirm\u007fchicken count' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in restaurant task title is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Confirm chicken count' collate "C" !~ '[[:cntrl:]]')
    and (E'Confirm\tchicken count' collate "C" ~ '[[:cntrl:]]')
    and (E'Confirm\nchicken count' collate "C" ~ '[[:cntrl:]]')
    and (E'Confirm\u007fchicken count' collate "C" ~ '[[:cntrl:]]'),
  true,
  'restaurant task title control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Confirm\tchicken count'),
      ('Confirm chicken count'),
      (E'Confirm\nchicken count'),
      (E'Confirm\u007fchicken count')
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
      and conname = 'restaurant_tasks_title_check'
  ),
  'between 1 and 160',
  'restaurant_tasks title CHECK keeps original length window'
);

select * from finish();
rollback;
