-- MISE-005ID: public.outreach_leads.cuisine CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept cuisine
-- bytes the restored C-locale gate would refuse. Sibling business_name /
-- contact_name / fit_notes / city / state / status / contact_basis CHECKs
-- stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_cuisine_check'
  ),
  'outreach_leads_cuisine_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_cuisine_check'
  ),
  'cuisine is null',
  'outreach_leads cuisine CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_cuisine_check'
  ),
  'length\(trim\(cuisine\)\) between 1 and 120',
  'outreach_leads cuisine CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_cuisine_check'
  ),
  'cuisine collate "C" !~ ''[[:cntrl:]]''',
  'outreach_leads cuisine CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'outreach_leads_cuisine_check'
    limit 1
  ) ilike '%business_name%',
  false,
  'cuisine CHECK stays dedicated (excludes business_name)'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_cuisine_check'
    limit 1
  ) ilike '%state%',
  false,
  'cuisine CHECK stays dedicated (excludes state)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Italian' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach lead cuisine is accepted under COLLATE C'
);

select is(
  (E'Ita\tlian' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach lead cuisine is rejected under COLLATE C'
);

select is(
  (E'Ita\nlian' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach lead cuisine is rejected under COLLATE C'
);

select is(
  (E'Ita\u007flian' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach lead cuisine is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Italian' collate "C" !~ '[[:cntrl:]]')
    and (E'Ita\tlian' collate "C" ~ '[[:cntrl:]]')
    and (E'Ita\nlian' collate "C" ~ '[[:cntrl:]]')
    and (E'Ita\u007flian' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach lead cuisine control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Ita\tlian'),
      ('Italian'),
      (E'Ita\nlian'),
      (E'Ita\u007flian')
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
      and conname = 'outreach_leads_cuisine_check'
  ),
  1::bigint,
  'exactly one cuisine_check constraint is attached'
);

select * from finish();
rollback;
