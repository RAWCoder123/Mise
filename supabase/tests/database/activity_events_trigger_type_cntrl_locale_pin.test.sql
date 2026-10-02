-- MISE-005FD: public.activity_events.trigger_type CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept trigger_type bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_type_check'
  ),
  'activity_events_trigger_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_type_check'
  ),
  'length\(trim\(trigger_type\)\) between 1 and 120',
  'activity_events trigger_type CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_type_check'
  ),
  'trigger_type collate "C" !~ ''[[:cntrl:]]''',
  'activity_events trigger_type CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('supplier_delivery_outcome' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity trigger_type is accepted under COLLATE C'
);

select is(
  (E'supplier\tdelivery' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity trigger_type is rejected under COLLATE C'
);

select is(
  (E'supplier\ndelivery' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity trigger_type is rejected under COLLATE C'
);

select is(
  (E'supplier\u0000delivery' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity trigger_type is rejected under COLLATE C'
);

select is(
  (E'supplier\u007fdelivery' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity trigger_type is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('supplier_delivery_outcome' collate "C" !~ '[[:cntrl:]]')
    and (E'supplier\tdelivery' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\ndelivery' collate "C" ~ '[[:cntrl:]]')
    and (E'supplier\u007fdelivery' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity trigger_type control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'supplier\tdelivery'),
      ('supplier_delivery_outcome'),
      (E'supplier\ndelivery'),
      (E'supplier\u007fdelivery')
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
      and conname = 'activity_events_trigger_type_check'
  ),
  'between 1 and 120',
  'activity_events trigger_type CHECK keeps original length window'
);

select * from finish();
rollback;
