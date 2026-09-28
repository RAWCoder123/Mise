-- MISE-005BI: outreach_events.provider_event_id CHECK must reject
-- control-bearing Svix webhook ids under COLLATE "C", so restore cannot
-- accept identity bytes sibling provider-id gates would refuse (and vice
-- versa).
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_event_id_check'
  ),
  'outreach_events_provider_event_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_event_id_check'
  ),
  'provider_event_id collate "C" !~ ''[[:cntrl:]]''',
  'provider_event_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_event_id_check'
  ),
  'length\(provider_event_id\) between 1 and 255',
  'provider_event_id CHECK bounds length 1–255'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E'msg_\tA' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('msg_2KhT9abc' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII Svix id is not a control under COLLATE C'
);

select is(
  ('msg_lower_1' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII lowercase Svix id is not a control under COLLATE C'
);

select is(
  (E'msg_\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select * from finish();
rollback;
