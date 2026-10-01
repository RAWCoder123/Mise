-- MISE-005EL: public.insights free-form content CHECK must keep its exact
-- length bounds and pin ASCII control rejection under COLLATE "C" so
-- dump/restore cannot accept insight bytes the restored C-locale gate
-- would refuse.
begin;
select plan(17);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'insights_content_bounds_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'length\(trim\(title\)\) between 1 and 240',
  'insights title CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'length\(trim\(description\)\) between 1 and 4000',
  'insights description CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'length\(trim\(recommended_action\)\) between 1 and 2000',
  'insights recommended_action CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'length\(why_it_matters\) <= 2000',
  'insights why_it_matters CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'title collate "C" !~ ''[[:cntrl:]]''',
  'insights title CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'description collate "C" !~ ''[[:cntrl:]]''',
  'insights description CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'recommended_action collate "C" !~ ''[[:cntrl:]]''',
  'insights recommended_action CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'why_it_matters collate "C" !~ ''[[:cntrl:]]''',
  'insights why_it_matters CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Rice is low' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable insight body text is accepted under COLLATE C'
);

select is(
  (E'Rice is\tlow' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in insight body text is rejected under COLLATE C'
);

select is(
  (E'Rice is\nlow' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in insight body text is rejected under COLLATE C'
);

select is(
  (E'Rice is\u007flow' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in insight body text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Rice is low' collate "C" !~ '[[:cntrl:]]')
    and (E'Rice is\tlow' collate "C" ~ '[[:cntrl:]]')
    and (E'Rice is\u007flow' collate "C" ~ '[[:cntrl:]]'),
  true,
  'insight body control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Rice is\tlow'),
      ('Rice is low'),
      (E'Rice is\nlow'),
      (E'Rice is\u007flow')
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
    where conrelid = 'public.insights'::regclass
      and conname = 'insights_content_bounds_check'
  ),
  'why_it_matters is null',
  'insights why_it_matters CHECK keeps nullability'
);

select * from finish();
rollback;
