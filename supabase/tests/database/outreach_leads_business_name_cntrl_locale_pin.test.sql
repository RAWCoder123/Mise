-- MISE-005HO: public.outreach_leads.business_name CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept business-name bytes the restored
-- C-locale gate would refuse. Sibling status / contact_basis / email /
-- source_url / website CHECKs stay on separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_business_name_check'
  ),
  'outreach_leads_business_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_business_name_check'
  ),
  'char_length\(btrim\(business_name\)\) between 1 and 160',
  'outreach_leads business_name CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_business_name_check'
  ),
  'business_name collate "C" !~ ''[[:cntrl:]]''',
  'outreach_leads business_name CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'outreach_leads_business_name_check'
    limit 1
  ) ilike '%contact_basis%',
  false,
  'business_name CHECK stays dedicated (excludes contact_basis)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach lead business_name is accepted under COLLATE C'
);

select is(
  (E'Harbor\tKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach lead business_name is rejected under COLLATE C'
);

select is(
  (E'Harbor\nKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach lead business_name is rejected under COLLATE C'
);

select is(
  (E'Harbor\u007fKitchen' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach lead business_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Harbor Kitchen' collate "C" !~ '[[:cntrl:]]')
    and (E'Harbor\tKitchen' collate "C" ~ '[[:cntrl:]]')
    and (E'Harbor\nKitchen' collate "C" ~ '[[:cntrl:]]')
    and (E'Harbor\u007fKitchen' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach lead business_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Harbor\tKitchen'),
      ('Harbor Kitchen'),
      (E'Harbor\nKitchen'),
      (E'Harbor\u007fKitchen')
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
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_business_name_check'
  ),
  'between 1 and 160',
  'outreach_leads business_name CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_business_name_check'
  ),
  1::bigint,
  'exactly one business_name_check constraint is attached'
);

select * from finish();
rollback;
