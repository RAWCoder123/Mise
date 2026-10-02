-- MISE-005FC: public.activity_events.source CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept source bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_source_check'
  ),
  'activity_events_source_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_source_check'
  ),
  'length\(trim\(source\)\) between 1 and 80',
  'activity_events source CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_source_check'
  ),
  'source collate "C" !~ ''[[:cntrl:]]''',
  'activity_events source CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('mise' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity source is accepted under COLLATE C'
);

select is(
  (E'mise\tinventory' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity source is rejected under COLLATE C'
);

select is(
  (E'mise\ninventory' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity source is rejected under COLLATE C'
);

select is(
  (E'mise\u0000inventory' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity source is rejected under COLLATE C'
);

select is(
  (E'mise\u007finventory' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity source is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('mise' collate "C" !~ '[[:cntrl:]]')
    and (E'mise\tinventory' collate "C" ~ '[[:cntrl:]]')
    and (E'mise\ninventory' collate "C" ~ '[[:cntrl:]]')
    and (E'mise\u007finventory' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity source control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'mise\tinventory'),
      ('mise'),
      (E'mise\ninventory'),
      (E'mise\u007finventory')
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
      and conname = 'activity_events_source_check'
  ),
  'between 1 and 80',
  'activity_events source CHECK keeps original length window'
);

select * from finish();
rollback;
