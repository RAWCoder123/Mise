-- MISE-005HX: public.outreach_messages.last_error CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept last_error
-- bytes the restored C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_last_error_check'
  ),
  'outreach_messages_last_error_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_last_error_check'
  ),
  'last_error is null',
  'outreach_messages last_error CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_last_error_check'
  ),
  'length\(trim\(last_error\)\) between 1 and 80',
  'outreach_messages last_error CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_last_error_check'
  ),
  'last_error collate "C" !~ ''[[:cntrl:]]''',
  'outreach_messages last_error CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('provider_delivery_failed' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach last_error is accepted under COLLATE C'
);

select is(
  (E'provider\tdelivery_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach last_error is rejected under COLLATE C'
);

select is(
  (E'provider\ndelivery_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach last_error is rejected under COLLATE C'
);

select is(
  (E'provider\u0000delivery_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in outreach last_error is rejected under COLLATE C'
);

select is(
  (E'provider\u007fdelivery_failed' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach last_error is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('provider_delivery_failed' collate "C" !~ '[[:cntrl:]]')
    and (E'provider\tdelivery_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'provider\ndelivery_failed' collate "C" ~ '[[:cntrl:]]')
    and (E'provider\u007fdelivery_failed' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach last_error control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'provider\tdelivery_failed'),
      ('provider_delivery_failed'),
      (E'provider\ndelivery_failed'),
      (E'provider\u007fdelivery_failed')
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
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_last_error_check'
  ),
  'between 1 and 80',
  'outreach_messages last_error CHECK keeps length window'
);

select * from finish();
rollback;
