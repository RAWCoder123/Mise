-- MISE-005EQ: public.recalculation_runs.failure_reason CHECK must keep the
-- exact nullability + length(trim) 1..200 bound and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept failure-reason
-- bytes the restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_failure_reason_check'
  ),
  'recalculation_runs_failure_reason_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_failure_check'
  ),
  'recalculation_runs_failure_check consistency constraint remains'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_failure_reason_check'
  ),
  'length\(trim\(failure_reason\)\) between 1 and 200',
  'recalculation_runs failure_reason CHECK keeps exact length bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_failure_reason_check'
  ),
  'failure_reason collate "C" !~ ''[[:cntrl:]]''',
  'recalculation_runs failure_reason CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recalculation_runs'::regclass
      and conname = 'recalculation_runs_failure_reason_check'
  ),
  'failure_reason is null',
  'recalculation_runs failure_reason CHECK keeps nullability'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('timeout exceeded' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable failure reason is accepted under COLLATE C'
);

select is(
  (E'timeout\texceeded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in failure reason is rejected under COLLATE C'
);

select is(
  (E'timeout\nexceeded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in failure reason is rejected under COLLATE C'
);

select is(
  (E'timeout\u007fexceeded' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in failure reason is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('timeout exceeded' collate "C" !~ '[[:cntrl:]]')
    and (E'timeout\texceeded' collate "C" ~ '[[:cntrl:]]')
    and (E'timeout\u007fexceeded' collate "C" ~ '[[:cntrl:]]'),
  true,
  'failure reason control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'timeout\texceeded'),
      ('timeout exceeded'),
      (E'timeout\nexceeded'),
      (E'timeout\u007fexceeded')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select * from finish();
rollback;
