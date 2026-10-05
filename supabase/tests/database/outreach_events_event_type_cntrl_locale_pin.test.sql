-- MISE-005HW: public.outreach_events.event_type CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept event_type bytes the restored
-- C-locale gate would refuse. Sibling provider_event_id /
-- provider_message_id CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_event_type_check'
  ),
  'outreach_events_event_type_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_event_type_check'
  ),
  'char_length\(btrim\(event_type\)\) between 1 and 100',
  'outreach_events event_type CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_event_type_check'
  ),
  'event_type collate "C" !~ ''[[:cntrl:]]''',
  'outreach_events event_type CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and contype = 'u'
      and (
        conname = 'outreach_events_provider_event_id_key'
        or pg_get_constraintdef(oid) ilike '%provider_event_id%'
      )
  ),
  'outreach_events provider_event_id UNIQUE remains intact'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and contype = 'c'
      and conname = 'outreach_events_event_type_check'
    limit 1
  ) ilike '%provider_event_id%',
  false,
  'event_type CHECK stays dedicated (excludes provider_event_id)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('email.delivered' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach event_type is accepted under COLLATE C'
);

select is(
  (E'email.\tdelivered' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach event_type is rejected under COLLATE C'
);

select is(
  (E'email.\ndelivered' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach event_type is rejected under COLLATE C'
);

select is(
  (E'email.\u007fdelivered' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach event_type is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('email.delivered' collate "C" !~ '[[:cntrl:]]')
    and (E'email.\tdelivered' collate "C" ~ '[[:cntrl:]]')
    and (E'email.\ndelivered' collate "C" ~ '[[:cntrl:]]')
    and (E'email.\u007fdelivered' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach event_type control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'email.\tdelivered'),
      ('email.delivered'),
      (E'email.\ndelivered'),
      (E'email.\u007fdelivered')
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
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_event_type_check'
  ),
  'between 1 and 100',
  'outreach_events event_type CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and contype = 'c'
      and conname = 'outreach_events_event_type_check'
  ),
  1::bigint,
  'exactly one event_type_check constraint is attached'
);

select * from finish();
rollback;
