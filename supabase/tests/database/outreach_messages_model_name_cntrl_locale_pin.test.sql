-- MISE-005IE: public.outreach_messages.model_name CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept model_name
-- bytes the restored C-locale gate would refuse.
begin;
select plan(13);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_model_name_check'
  ),
  'outreach_messages_model_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_model_name_check'
  ),
  'model_name is null',
  'outreach_messages model_name CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_model_name_check'
  ),
  'length\(trim\(model_name\)\) between 1 and 80',
  'outreach_messages model_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_model_name_check'
  ),
  'model_name collate "C" !~ ''[[:cntrl:]]''',
  'outreach_messages model_name CHECK uses COLLATE C cntrl rejection'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('gpt-5.6' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach model_name is accepted under COLLATE C'
);

select is(
  (E'gpt\t5.6' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach model_name is rejected under COLLATE C'
);

select is(
  (E'gpt\n5.6' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach model_name is rejected under COLLATE C'
);

select is(
  (E'gpt\u00005.6' collate "C" !~ '[[:cntrl:]]'),
  false,
  'NUL in outreach model_name is rejected under COLLATE C'
);

select is(
  (E'gpt\u007f5.6' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach model_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('gpt-5.6' collate "C" !~ '[[:cntrl:]]')
    and (E'gpt\t5.6' collate "C" ~ '[[:cntrl:]]')
    and (E'gpt\n5.6' collate "C" ~ '[[:cntrl:]]')
    and (E'gpt\u007f5.6' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach model_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'gpt\t5.6'),
      ('gpt-5.6'),
      (E'gpt\n5.6'),
      (E'gpt\u007f5.6')
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
      and conname = 'outreach_messages_model_name_check'
  ),
  'between 1 and 80',
  'outreach_messages model_name CHECK keeps length window'
);

select * from finish();
rollback;
