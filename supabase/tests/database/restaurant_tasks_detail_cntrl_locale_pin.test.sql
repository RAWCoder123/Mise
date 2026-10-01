-- MISE-005EP: public.restaurant_tasks.detail CHECK must keep its exact
-- length(trim) bound and pin multiline-aware ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept task-detail bytes the restored
-- C-locale gate would refuse, while still allowing LF/TAB/CR for the
-- multiline create-task body field.
begin;
select plan(14);

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
  'detail collate "C" !~',
  'restaurant_tasks detail CHECK uses COLLATE C multiline-aware cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on these ASCII bytes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Count the walk-in case before ordering.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable restaurant task detail text is accepted under COLLATE C'
);

select is(
  (E'Count the walk-in\ncase' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in restaurant task detail text is accepted under COLLATE C'
);

select is(
  (E'Count the walk-in\tcase' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in restaurant task detail text is accepted under COLLATE C'
);

select is(
  (E'Count the walk-in\rcase' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in restaurant task detail text is accepted under COLLATE C'
);

select is(
  (E'Count the walk-in\u0000case' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'NUL in restaurant task detail text is rejected under COLLATE C'
);

select is(
  (E'Count the walk-in\u007fcase' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in restaurant task detail text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe control characters under COLLATE C'
);

select is(
  ('Count the walk-in case before ordering.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Count the walk-in\ncase' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Count the walk-in\u0000case' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Count the walk-in\u007fcase' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'restaurant task detail control detector matches multiline-aware ASCII class'
);

select is(
  (
    select count(*)
    from (values
      (E'Count the walk-in\ncase'),
      ('Count the walk-in case before ordering.'),
      (E'Count the walk-in\u0000case'),
      (E'Count the walk-in\u007fcase')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline-aware ASCII control detector is identical under C and under the database ctype'
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
