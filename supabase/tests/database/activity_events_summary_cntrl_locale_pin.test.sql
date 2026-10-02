-- MISE-005EZ: public.activity_events.summary CHECK must keep its exact
-- length(trim) bound and pin multiline-aware ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept summary bytes the restored
-- C-locale gate would refuse, while still allowing LF/TAB/CR (operator
-- correction may flow into summary via supplier-delivery memory updates).
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_summary_check'
  ),
  'activity_events_summary_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_summary_check'
  ),
  'length\(trim\(summary\)\) between 1 and 1000',
  'activity_events summary CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_summary_check'
  ),
  'summary collate "C" !~',
  'activity_events summary CHECK uses COLLATE C control rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Chicken thighs need manager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable activity summary is accepted under COLLATE C'
);

select is(
  (E'Chicken thighs need\nmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in activity summary is accepted under multiline-aware gate'
);

select is(
  (E'Chicken thighs need\tmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in activity summary is accepted under multiline-aware gate'
);

select is(
  (E'Chicken thighs need\rmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in activity summary is accepted under multiline-aware gate'
);

select is(
  (E'Chicken thighs need\x08manager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in activity summary is rejected under COLLATE C'
);

select is(
  (E'Chicken thighs need\x0bmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in activity summary is rejected under COLLATE C'
);

select is(
  (E'Chicken thighs need\u007fmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in activity summary is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Chicken thighs need manager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Chicken thighs need\nmanager approval before send.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Chicken thighs need\x0bmanager approval before send.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Chicken thighs need\u007fmanager approval before send.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'activity summary multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Chicken thighs need\tmanager approval before send.'),
      ('Chicken thighs need manager approval before send.'),
      (E'Chicken thighs need\nmanager approval before send.'),
      (E'Chicken thighs need\rmanager approval before send.'),
      (E'Chicken thighs need\x0bmanager approval before send.'),
      (E'Chicken thighs need\u007fmanager approval before send.')
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
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_summary_check'
  ),
  'between 1 and 1000',
  'activity_events summary CHECK keeps original length window'
);

select * from finish();
rollback;
