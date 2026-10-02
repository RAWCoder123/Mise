-- MISE-005EX: public.operational_issues.explanation CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept explanation bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_explanation_check'
  ),
  'operational_issues_explanation_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_explanation_check'
  ),
  'length\(trim\(explanation\)\) between 1 and 2000',
  'operational_issues explanation CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.operational_issues'::regclass
      and conname = 'operational_issues_explanation_check'
  ),
  'explanation collate "C" !~ ''[[:cntrl:]]''',
  'operational_issues explanation CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Projected coverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable operational issue explanation is accepted under COLLATE C'
);

select is(
  (E'Projected\tcoverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in operational issue explanation is rejected under COLLATE C'
);

select is(
  (E'Projected\ncoverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in operational issue explanation is rejected under COLLATE C'
);

select is(
  (E'Projected\u0000coverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in operational issue explanation is rejected under COLLATE C'
);

select is(
  (E'Projected\u007fcoverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in operational issue explanation is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Projected coverage is below the reorder threshold.' collate "C" !~ '[[:cntrl:]]')
    and (E'Projected\tcoverage is below the reorder threshold.' collate "C" ~ '[[:cntrl:]]')
    and (E'Projected\ncoverage is below the reorder threshold.' collate "C" ~ '[[:cntrl:]]')
    and (E'Projected\u007fcoverage is below the reorder threshold.' collate "C" ~ '[[:cntrl:]]'),
  true,
  'operational issue explanation control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Projected\tcoverage is below the reorder threshold.'),
      ('Projected coverage is below the reorder threshold.'),
      (E'Projected\ncoverage is below the reorder threshold.'),
      (E'Projected\u007fcoverage is below the reorder threshold.')
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
      and conname = 'operational_issues_explanation_check'
  ),
  'between 1 and 2000',
  'operational_issues explanation CHECK keeps original length window'
);

select * from finish();
rollback;
