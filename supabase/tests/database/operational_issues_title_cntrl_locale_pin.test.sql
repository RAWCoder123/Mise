-- MISE-005EW: public.operational_issues.title CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept title bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_title_check'
  ),
  'operational_issues_title_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_title_check'
  ),
  'length\(trim\(title\)\) between 1 and 160',
  'operational_issues title CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_title_check'
  ),
  'title collate "C" !~ ''[[:cntrl:]]''',
  'operational_issues title CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Chicken may run out' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable operational issue title is accepted under COLLATE C'
);

select is(
  (E'Chicken\tmay run out' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in operational issue title is rejected under COLLATE C'
);

select is(
  (E'Chicken\nmay run out' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in operational issue title is rejected under COLLATE C'
);

select is(
  (E'Chicken\u0000may run out' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in operational issue title is rejected under COLLATE C'
);

select is(
  (E'Chicken\u007fmay run out' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in operational issue title is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Chicken may run out' collate "C" !~ '[[:cntrl:]]')
    and (E'Chicken\tmay run out' collate "C" ~ '[[:cntrl:]]')
    and (E'Chicken\nmay run out' collate "C" ~ '[[:cntrl:]]')
    and (E'Chicken\u007fmay run out' collate "C" ~ '[[:cntrl:]]'),
  true,
  'operational issue title control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Chicken\tmay run out'),
      ('Chicken may run out'),
      (E'Chicken\nmay run out'),
      (E'Chicken\u007fmay run out')
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
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_title_check'
  ),
  'between 1 and 160',
  'operational_issues title CHECK keeps original length window'
);

select * from finish();
rollback;
