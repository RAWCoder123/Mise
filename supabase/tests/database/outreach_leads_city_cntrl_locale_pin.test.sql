-- MISE-005IB: public.outreach_leads.city CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept city
-- bytes the restored C-locale gate would refuse. Sibling business_name /
-- contact_name / fit_notes / status / contact_basis CHECKs stay on
-- separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_city_check'
  ),
  'outreach_leads_city_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_city_check'
  ),
  'city is null',
  'outreach_leads city CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_city_check'
  ),
  'length\(trim\(city\)\) between 1 and 120',
  'outreach_leads city CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_city_check'
  ),
  'city collate "C" !~ ''[[:cntrl:]]''',
  'outreach_leads city CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'outreach_leads_city_check'
    limit 1
  ) ilike '%business_name%',
  false,
  'city CHECK stays dedicated (excludes business_name)'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_city_check'
    limit 1
  ) ilike '%contact_name%',
  false,
  'city CHECK stays dedicated (excludes contact_name)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Austin' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach lead city is accepted under COLLATE C'
);

select is(
  (E'Aus\ttin' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach lead city is rejected under COLLATE C'
);

select is(
  (E'Aus\ntin' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach lead city is rejected under COLLATE C'
);

select is(
  (E'Aus\u007ftin' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach lead city is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Austin' collate "C" !~ '[[:cntrl:]]')
    and (E'Aus\ttin' collate "C" ~ '[[:cntrl:]]')
    and (E'Aus\ntin' collate "C" ~ '[[:cntrl:]]')
    and (E'Aus\u007ftin' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach lead city control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Aus\ttin'),
      ('Austin'),
      (E'Aus\ntin'),
      (E'Aus\u007ftin')
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
      and conname = 'outreach_leads_city_check'
  ),
  1::bigint,
  'exactly one city_check constraint is attached'
);

select * from finish();
rollback;
