-- MISE-005ES: public.restaurant_tasks.completion_result CHECK must keep its
-- exact length(trim) bound and pin multiline-aware ASCII control rejection
-- under COLLATE "C" so dump/restore cannot accept completion-result bytes
-- the restored C-locale gate would refuse, while still allowing LF/TAB/CR
-- for the multiline complete-task result field.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_completion_result_bound_check'
  ),
  'restaurant_tasks_completion_result_bound_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_completion_result_bound_check'
  ),
  'length\(trim\(completion_result\)\) between 1 and 1000',
  'restaurant_tasks completion_result CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_completion_result_bound_check'
  ),
  'completion_result is null',
  'restaurant_tasks completion_result CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_completion_result_bound_check'
  ),
  'completion_result collate "C" !~',
  'restaurant_tasks completion_result CHECK uses COLLATE C multiline-aware cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on these ASCII bytes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Counted 18 lb of chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable restaurant task completion result text is accepted under COLLATE C'
);

select is(
  (E'Counted 18 lb\nof chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in restaurant task completion result text is accepted under COLLATE C'
);

select is(
  (E'Counted 18 lb\tof chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in restaurant task completion result text is accepted under COLLATE C'
);

select is(
  (E'Counted 18 lb\rof chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in restaurant task completion result text is accepted under COLLATE C'
);

select is(
  (E'Counted 18 lb\u0000of chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'NUL in restaurant task completion result text is rejected under COLLATE C'
);

select is(
  (E'Counted 18 lb\u007fof chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in restaurant task completion result text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe control characters under COLLATE C'
);

select is(
  ('Counted 18 lb of chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Counted 18 lb\nof chicken.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Counted 18 lb\u0000of chicken.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Counted 18 lb\u007fof chicken.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'restaurant task completion result control detector matches multiline-aware ASCII class'
);

select is(
  (
    select count(*)
    from (values
      (E'Counted 18 lb\nof chicken.'),
      ('Counted 18 lb of chicken.'),
      (E'Counted 18 lb\u0000of chicken.'),
      (E'Counted 18 lb\u007fof chicken.')
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
      and conname = 'restaurant_tasks_completion_result_bound_check'
  ),
  'between 1 and 1000',
  'restaurant_tasks completion_result CHECK keeps original length window'
);

select * from finish();
rollback;
