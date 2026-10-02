-- MISE-005FJ: public.activity_events.sequence_id CHECK must keep
-- its null-or-length(trim) 1..240 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept sequence_id bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_sequence_id_check'
  ),
  'activity_events_sequence_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_sequence_id_check'
  ),
  'length\(trim\(sequence_id\)\) between 1 and 240',
  'activity_events sequence_id CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_sequence_id_check'
  ),
  'sequence_id collate "C" !~ ''[[:cntrl:]]''',
  'activity_events sequence_id CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('recalculation:2026-08-05:close' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity sequence_id is accepted under COLLATE C'
);

select is(
  (E'recalculation\tclose' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity sequence_id is rejected under COLLATE C'
);

select is(
  (E'recalculation\nclose' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity sequence_id is rejected under COLLATE C'
);

select is(
  (E'recalculation\u0000close' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity sequence_id is rejected under COLLATE C'
);

select is(
  (E'recalculation\u007fclose' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity sequence_id is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('recalculation:2026-08-05:close' collate "C" !~ '[[:cntrl:]]')
    and (E'recalculation\tclose' collate "C" ~ '[[:cntrl:]]')
    and (E'recalculation\nclose' collate "C" ~ '[[:cntrl:]]')
    and (E'recalculation\u007fclose' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity sequence_id control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'recalculation\tclose'),
      ('recalculation:2026-08-05:close'),
      (E'recalculation\nclose'),
      (E'recalculation\u007fclose')
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
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_sequence_id_check'
  ),
  'between 1 and 240',
  'activity_events sequence_id CHECK keeps original length window'
);

select * from finish();
rollback;
