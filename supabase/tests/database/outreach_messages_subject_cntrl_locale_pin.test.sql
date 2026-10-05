-- MISE-005HV: public.outreach_messages.subject CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept subject bytes the restored
-- C-locale gate would refuse. Sibling body_text / body_html /
-- personalization_note / status CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_subject_check'
  ),
  'outreach_messages_subject_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_subject_check'
  ),
  'char_length\(btrim\(subject\)\) between 1 and 78',
  'outreach_messages subject CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_subject_check'
  ),
  'subject collate "C" !~ ''[[:cntrl:]]''',
  'outreach_messages subject CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_messages_body_text_check'
        or pg_get_constraintdef(oid) ilike '%body_text%'
      )
  ),
  'outreach_messages body_text CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and conname = 'outreach_messages_subject_check'
    limit 1
  ) ilike '%body_text%',
  false,
  'subject CHECK stays dedicated (excludes body_text)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Cut food cost without new staff' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach message subject is accepted under COLLATE C'
);

select is(
  (E'Cut food\tcost without new staff' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach message subject is rejected under COLLATE C'
);

select is(
  (E'Cut food\ncost without new staff' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach message subject is rejected under COLLATE C'
);

select is(
  (E'Cut food\u007fcost without new staff' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach message subject is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Cut food cost without new staff' collate "C" !~ '[[:cntrl:]]')
    and (E'Cut food\tcost without new staff' collate "C" ~ '[[:cntrl:]]')
    and (E'Cut food\ncost without new staff' collate "C" ~ '[[:cntrl:]]')
    and (E'Cut food\u007fcost without new staff' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach message subject control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Cut food\tcost without new staff'),
      ('Cut food cost without new staff'),
      (E'Cut food\ncost without new staff'),
      (E'Cut food\u007fcost without new staff')
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
      and conname = 'outreach_messages_subject_check'
  ),
  'between 1 and 78',
  'outreach_messages subject CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and conname = 'outreach_messages_subject_check'
  ),
  1::bigint,
  'exactly one subject_check constraint is attached'
);

select * from finish();
rollback;
