-- MISE-005HS: public.outreach_messages.personalization_note CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept personalization
-- note bytes the restored C-locale gate would refuse, while still allowing
-- LF/TAB/CR. Sibling subject / body_text / body_html / status CHECKs stay on
-- separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_personalization_note_check'
  ),
  'outreach_messages_personalization_note_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_personalization_note_check'
  ),
  'char_length\(btrim\(personalization_note\)\) between 1 and 500',
  'outreach_messages personalization_note CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_personalization_note_check'
  ),
  'personalization_note collate "C" !~',
  'outreach_messages personalization_note CHECK uses COLLATE C control rejection'
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
      and conname = 'outreach_messages_personalization_note_check'
    limit 1
  ) ilike '%body_text%',
  false,
  'personalization_note CHECK stays dedicated (excludes body_text)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Used only supplied business details from the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach message personalization note is accepted under COLLATE C'
);

select is(
  (E'Used only supplied business details\nfrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach message personalization note is accepted under multiline-aware gate'
);

select is(
  (E'Used only supplied business details\tfrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach message personalization note is accepted under multiline-aware gate'
);

select is(
  (E'Used only supplied business details\rfrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach message personalization note is accepted under multiline-aware gate'
);

select is(
  (E'Used only supplied business details\x08from the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach message personalization note is rejected under COLLATE C'
);

select is(
  (E'Used only supplied business details\x0bfrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach message personalization note is rejected under COLLATE C'
);

select is(
  (E'Used only supplied business details\u007ffrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach message personalization note is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Used only supplied business details from the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Used only supplied business details\nfrom the lead record' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Used only supplied business details\x0bfrom the lead record' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Used only supplied business details\u007ffrom the lead record' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach message personalization note multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Used only supplied business details\tfrom the lead record'),
      ('Used only supplied business details from the lead record'),
      (E'Used only supplied business details\nfrom the lead record'),
      (E'Used only supplied business details\rfrom the lead record'),
      (E'Used only supplied business details\x0bfrom the lead record'),
      (E'Used only supplied business details\u007ffrom the lead record')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
  ),
  0::bigint,
  'multiline ASCII control detector is identical under C and under the database ctype'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and conname = 'outreach_messages_personalization_note_check'
  ),
  1::bigint,
  'exactly one personalization_note_check constraint is attached'
);

select * from finish();
rollback;
