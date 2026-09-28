-- MISE-005BJ: outreach_messages / outreach_events provider_message_id CHECKs
-- must reject control-bearing Resend email ids under COLLATE "C", so restore
-- cannot accept identity bytes sibling provider-id gates would refuse (and
-- vice versa). Join parity requires the same length + cntrl contract on both
-- columns.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_provider_message_id_check'
  ),
  'outreach_messages_provider_message_id_check exists'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_message_id_check'
  ),
  'outreach_events_provider_message_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_provider_message_id_check'
  ),
  'provider_message_id collate "C" !~ ''[[:cntrl:]]''',
  'outreach_messages.provider_message_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_message_id_check'
  ),
  'provider_message_id collate "C" !~ ''[[:cntrl:]]''',
  'outreach_events.provider_message_id CHECK uses COLLATE C cntrl rejection'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_provider_message_id_check'
  ),
  'length\(provider_message_id\) between 1 and 512',
  'outreach_messages.provider_message_id CHECK bounds length 1–512'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_message_id_check'
  ),
  'length\(provider_message_id\) between 1 and 512',
  'outreach_events.provider_message_id CHECK bounds length 1–512'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (E're_abc\tA' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII tab is a control under COLLATE C'
);

select is(
  ('re_2KhT9abc' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII Resend id is not a control under COLLATE C'
);

select is(
  ('re_lower_1' collate "C" ~ '[[:cntrl:]]'),
  false,
  'printable ASCII lowercase Resend id is not a control under COLLATE C'
);

select is(
  (E're_abc\u007f' collate "C" ~ '[[:cntrl:]]'),
  true,
  'ASCII DEL is a control under COLLATE C'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_provider_message_id_check'
  ),
  'provider_message_id is null',
  'outreach_messages.provider_message_id CHECK allows null'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_events'::regclass
      and conname = 'outreach_events_provider_message_id_check'
  ),
  'provider_message_id is null',
  'outreach_events.provider_message_id CHECK allows null'
);

select * from finish();
rollback;
