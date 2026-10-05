-- MISE-005HU: public.outreach_messages.body_html CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept body-html
-- bytes the restored C-locale gate would refuse, while still allowing
-- LF/TAB/CR. Sibling subject / body_text / personalization_note / status
-- CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_html_check'
  ),
  'outreach_messages_body_html_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_html_check'
  ),
  'char_length\(btrim\(body_html\)\) between 1 and 12000',
  'outreach_messages body_html CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_messages'::regclass
      and conname = 'outreach_messages_body_html_check'
  ),
  'body_html collate "C" !~',
  'outreach_messages body_html CHECK uses COLLATE C control rejection'
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
      and conname = 'outreach_messages_body_html_check'
    limit 1
  ) ilike '%body_text%',
  false,
  'body_html CHECK stays dedicated (excludes body_text)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('<p>Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach message body html is accepted under COLLATE C'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\n<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach message body html is accepted under multiline-aware gate'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\t<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach message body html is accepted under multiline-aware gate'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\r<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach message body html is accepted under multiline-aware gate'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\x08<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach message body html is rejected under COLLATE C'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\x0b<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach message body html is rejected under COLLATE C'
);

select is(
  (E'<p>Thanks for running your restaurant.</p>\u007f<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach message body html is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('<p>Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'<p>Thanks for running your restaurant.</p>\n<p>Mise helps independent kitchens plan inventory.</p>' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'<p>Thanks for running your restaurant.</p>\x0b<p>Mise helps independent kitchens plan inventory.</p>' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'<p>Thanks for running your restaurant.</p>\u007f<p>Mise helps independent kitchens plan inventory.</p>' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach message body html multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'<p>Thanks for running your restaurant.</p>\t<p>Mise helps independent kitchens plan inventory.</p>'),
      ('<p>Thanks for running your restaurant. Mise helps independent kitchens plan inventory without chain-scale staff.</p>'),
      (E'<p>Thanks for running your restaurant.</p>\n<p>Mise helps independent kitchens plan inventory.</p>'),
      (E'<p>Thanks for running your restaurant.</p>\r<p>Mise helps independent kitchens plan inventory.</p>'),
      (E'<p>Thanks for running your restaurant.</p>\x0b<p>Mise helps independent kitchens plan inventory.</p>'),
      (E'<p>Thanks for running your restaurant.</p>\u007f<p>Mise helps independent kitchens plan inventory.</p>')
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
      and conname = 'outreach_messages_body_html_check'
  ),
  1::bigint,
  'exactly one body_html_check constraint is attached'
);

select * from finish();
rollback;
