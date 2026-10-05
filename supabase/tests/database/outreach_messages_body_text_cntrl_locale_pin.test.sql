-- MISE-005HT: public.outreach_messages.body_text CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept body-text
-- bytes the restored C-locale gate would refuse, while still allowing
-- LF/TAB/CR. Sibling subject / body_html / personalization_note / status
-- CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_text_check'
  ),
  'outreach_messages_body_text_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_text_check'
  ),
  'char_length\(btrim\(body_text\)\) between 1 and 4000',
  'outreach_messages body_text CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_text_check'
  ),
  'body_text collate "C" !~',
  'outreach_messages body_text CHECK uses COLLATE C control rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_messages_body_html_check'
        or pg_get_constraintdef(oid) ilike '%body_html%'
      )
  ),
  'outreach_messages body_html CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and contype = 'c'
      and conname = 'outreach_messages_body_text_check'
    limit 1
  ) ilike '%body_html%',
  false,
  'body_text CHECK stays dedicated (excludes body_html)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach message body text is accepted under COLLATE C'
);

select is(
  (E'Thanks for running your restaurant.\nMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach message body text is accepted under multiline-aware gate'
);

select is(
  (E'Thanks for running your restaurant.\tMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach message body text is accepted under multiline-aware gate'
);

select is(
  (E'Thanks for running your restaurant.\rMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach message body text is accepted under multiline-aware gate'
);

select is(
  (E'Thanks for running your restaurant.\x08Mise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach message body text is rejected under COLLATE C'
);

select is(
  (E'Thanks for running your restaurant.\x0bMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach message body text is rejected under COLLATE C'
);

select is(
  (E'Thanks for running your restaurant.\u007fMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach message body text is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Thanks for running your restaurant.\nMise helps independent kitchens plan inventory.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Thanks for running your restaurant.\x0bMise helps independent kitchens plan inventory.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Thanks for running your restaurant.\u007fMise helps independent kitchens plan inventory.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach message body text multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Thanks for running your restaurant.\tMise helps independent kitchens plan inventory.'),
      ('Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.'),
      (E'Thanks for running your restaurant.\nMise helps independent kitchens plan inventory.'),
      (E'Thanks for running your restaurant.\rMise helps independent kitchens plan inventory.'),
      (E'Thanks for running your restaurant.\x0bMise helps independent kitchens plan inventory.'),
      (E'Thanks for running your restaurant.\u007fMise helps independent kitchens plan inventory.')
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
      and conname = 'outreach_messages_body_text_check'
  ),
  1::bigint,
  'exactly one body_text_check constraint is attached'
);

select * from finish();
rollback;
