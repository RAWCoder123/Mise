-- MISE-005IA: public.outreach_leads.contact_name CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept contact-name
-- bytes the restored C-locale gate would refuse. Sibling business_name /
-- fit_notes / status / contact_basis CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_name_check'
  ),
  'outreach_leads_contact_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_name_check'
  ),
  'contact_name is null',
  'outreach_leads contact_name CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_name_check'
  ),
  'length\(trim\(contact_name\)\) between 1 and 120',
  'outreach_leads contact_name CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_contact_name_check'
  ),
  'contact_name collate "C" !~ ''[[:cntrl:]]''',
  'outreach_leads contact_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_leads_business_name_check'
        or pg_get_constraintdef(oid) ilike '%business_name%'
      )
  ),
  'outreach_leads business_name CHECK remains attachable'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_leads_status_check'
        or pg_get_constraintdef(oid) ilike '%status%'
      )
  ),
  'outreach_leads status CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_contact_name_check'
    limit 1
  ) ilike '%business_name%',
  false,
  'contact_name CHECK stays dedicated (excludes business_name)'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_contact_name_check'
    limit 1
  ) ilike '%contact_basis%',
  false,
  'contact_name CHECK stays dedicated (excludes contact_basis)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Jordan Lee' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach lead contact_name is accepted under COLLATE C'
);

select is(
  (E'Jordan\tLee' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach lead contact_name is rejected under COLLATE C'
);

select is(
  (E'Jordan\nLee' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach lead contact_name is rejected under COLLATE C'
);

select is(
  (E'Jordan\u007fLee' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach lead contact_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Jordan Lee' collate "C" !~ '[[:cntrl:]]')
    and (E'Jordan\tLee' collate "C" ~ '[[:cntrl:]]')
    and (E'Jordan\nLee' collate "C" ~ '[[:cntrl:]]')
    and (E'Jordan\u007fLee' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach lead contact_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Jordan\tLee'),
      ('Jordan Lee'),
      (E'Jordan\nLee'),
      (E'Jordan\u007fLee')
    ) fixture(sample)
    where (fixture.sample collate "C" ~ '[[:cntrl:]]')
      is distinct from
      (fixture.sample collate "en_US.utf8" ~ '[[:cntrl:]]')
  ),
  0::bigint,
  'ASCII control detector is identical under C and under the database ctype'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_contact_name_check'
  ),
  1::bigint,
  'exactly one contact_name_check constraint is attached'
);

select * from finish();
rollback;
