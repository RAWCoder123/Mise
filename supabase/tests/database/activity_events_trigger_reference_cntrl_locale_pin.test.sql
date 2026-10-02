-- MISE-005FG: public.activity_events.trigger_reference CHECK must keep
-- its null-or-length(trim) 1..240 bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept trigger_reference bytes the
-- restored C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_reference_check'
  ),
  'activity_events_trigger_reference_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_reference_check'
  ),
  'length\(trim\(trigger_reference\)\) between 1 and 240',
  'activity_events trigger_reference CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.activity_events'::regclass
      and conname = 'activity_events_trigger_reference_check'
  ),
  'trigger_reference collate "C" !~ ''[[:cntrl:]]''',
  'activity_events trigger_reference CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable activity trigger_reference is accepted under COLLATE C'
);

select is(
  (E'inventory\trisk:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in activity trigger_reference is rejected under COLLATE C'
);

select is(
  (E'inventory\nrisk:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in activity trigger_reference is rejected under COLLATE C'
);

select is(
  (E'inventory\u0000risk:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in activity trigger_reference is rejected under COLLATE C'
);

select is(
  (E'inventory\u007frisk:item-1' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in activity trigger_reference is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('a0000000-0000-4000-8000-000000000001' collate "C" !~ '[[:cntrl:]]')
    and (E'inventory\trisk:item-1' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory\nrisk:item-1' collate "C" ~ '[[:cntrl:]]')
    and (E'inventory\u007frisk:item-1' collate "C" ~ '[[:cntrl:]]'),
  true,
  'activity trigger_reference control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'inventory\trisk:item-1'),
      ('a0000000-0000-4000-8000-000000000001'),
      (E'inventory\nrisk:item-1'),
      (E'inventory\u007frisk:item-1')
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
      and conname = 'activity_events_trigger_reference_check'
  ),
  'between 1 and 240',
  'activity_events trigger_reference CHECK keeps original length window'
);

select * from finish();
rollback;
