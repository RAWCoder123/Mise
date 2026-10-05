-- MISE-005IC: public.outreach_leads.state CHECK must keep
-- nullability, bound length(trim) when present, and pin ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept state
-- bytes the restored C-locale gate would refuse. Sibling business_name /
-- contact_name / fit_notes / city / status / contact_basis CHECKs stay on
-- separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_state_check'
  ),
  'outreach_leads_state_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_state_check'
  ),
  'state is null',
  'outreach_leads state CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_state_check'
  ),
  'length\(trim\(state\)\) between 1 and 80',
  'outreach_leads state CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_state_check'
  ),
  'state collate "C" !~ ''[[:cntrl:]]''',
  'outreach_leads state CHECK uses COLLATE C cntrl rejection'
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
      and conname = 'outreach_leads_state_check'
    limit 1
  ) ilike '%business_name%',
  false,
  'state CHECK stays dedicated (excludes business_name)'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_state_check'
    limit 1
  ) ilike '%city%',
  false,
  'state CHECK stays dedicated (excludes city)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('TX' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach lead state is accepted under COLLATE C'
);

select is(
  (E'T\tX' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach lead state is rejected under COLLATE C'
);

select is(
  (E'T\nX' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach lead state is rejected under COLLATE C'
);

select is(
  (E'T\u007fX' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach lead state is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('TX' collate "C" !~ '[[:cntrl:]]')
    and (E'T\tX' collate "C" ~ '[[:cntrl:]]')
    and (E'T\nX' collate "C" ~ '[[:cntrl:]]')
    and (E'T\u007fX' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach lead state control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'T\tX'),
      ('TX'),
      (E'T\nX'),
      (E'T\u007fX')
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
      and conname = 'outreach_leads_state_check'
  ),
  1::bigint,
  'exactly one state_check constraint is attached'
);

select * from finish();
rollback;
