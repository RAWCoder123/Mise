-- MISE-005HB: public.action_outcomes.lesson CHECK must keep nullability,
-- bound length(trim) when present, and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept lesson bytes
-- the restored C-locale gate would refuse, while still allowing LF/TAB/CR
-- (free-form outcome text; may also flow into activity_events.summary).
begin;
select plan(15);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_lesson_check'
  ),
  'action_outcomes_lesson_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_lesson_check'
  ),
  'lesson is null',
  'action_outcomes lesson CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_lesson_check'
  ),
  'length\(trim\(lesson\)\) between 1 and 1000',
  'action_outcomes lesson CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_lesson_check'
  ),
  'lesson collate "C" !~',
  'action_outcomes lesson CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('The supplier order was received as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable action outcome lesson is accepted under COLLATE C'
);

select is(
  (E'The supplier order was\nreceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in action outcome lesson is accepted under multiline-aware gate'
);

select is(
  (E'The supplier order was\treceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in action outcome lesson is accepted under multiline-aware gate'
);

select is(
  (E'The supplier order was\rreceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in action outcome lesson is accepted under multiline-aware gate'
);

select is(
  (E'The supplier order was\x08received as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in action outcome lesson is rejected under COLLATE C'
);

select is(
  (E'The supplier order was\x0breceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in action outcome lesson is rejected under COLLATE C'
);

select is(
  (E'The supplier order was\u007freceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in action outcome lesson is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('The supplier order was received as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The supplier order was\nreceived as expected.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The supplier order was\x0breceived as expected.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'The supplier order was\u007freceived as expected.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'action outcome lesson multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'The supplier order was\treceived as expected.'),
      ('The supplier order was received as expected.'),
      (E'The supplier order was\nreceived as expected.'),
      (E'The supplier order was\rreceived as expected.'),
      (E'The supplier order was\x0breceived as expected.'),
      (E'The supplier order was\u007freceived as expected.')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.action_outcomes'::regclass
      and conname = 'action_outcomes_lesson_check'
  ),
  'between 1 and 1000',
  'action_outcomes lesson CHECK keeps original length window'
);

select * from finish();
rollback;
