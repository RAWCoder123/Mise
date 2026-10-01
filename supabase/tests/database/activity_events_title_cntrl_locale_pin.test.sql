-- MISE-005EV: public.activity_events.title CHECK must keep its exact
-- length(trim) bound and pin ASCII control rejection under COLLATE "C"
-- so dump/restore cannot accept title bytes the restored C-locale gate
-- would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_title_check'
  ),
  'activity_events_title_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_title_check'
  ),
  'length\(trim\(title\)\) between 1 and 160',
  'activity_events title CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_title_check'
  ),
  'title collate "C" !~ ''[[:cntrl:]]''',
  'activity_events title CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Order approved' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity title is accepted under COLLATE C'
);

select is(
  (E'Order\tapproved' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity title is rejected under COLLATE C'
);

select is(
  (E'Order\napproved' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity title is rejected under COLLATE C'
);

select is(
  (E'Order\u0000approved' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity title is rejected under COLLATE C'
);

select is(
  (E'Order\u007fapproved' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity title is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Order approved' collate "C" !~ '[[:cntrl:]]')
    and (E'Order\tapproved' collate "C" ~ '[[:cntrl:]]')
    and (E'Order\napproved' collate "C" ~ '[[:cntrl:]]')
    and (E'Order\u007fapproved' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity title control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Order\tapproved'),
      ('Order approved'),
      (E'Order\napproved'),
      (E'Order\u007fapproved')
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
      and conname = 'activity_events_title_check'
  ),
  'between 1 and 160',
  'activity_events title CHECK keeps original length window'
);

select * from finish();
rollback;
