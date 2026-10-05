-- MISE-005HZ: public.outreach_leads.fit_notes CHECK must keep
-- nullability, bound length(trim) when present, and pin multiline-aware
-- ASCII control rejection under COLLATE "C" so dump/restore cannot accept
-- fit_notes bytes the restored C-locale gate would refuse, while still
-- allowing LF/TAB/CR (free-form lead-fit rationale). Sibling business_name /
-- status / contact_basis CHECKs stay on separate constraints.
begin;
select plan(17);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_fit_notes_check'
  ),
  'outreach_leads_fit_notes_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_fit_notes_check'
  ),
  'fit_notes is null',
  'outreach_leads fit_notes CHECK keeps nullability'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_fit_notes_check'
  ),
  'length\(trim\(fit_notes\)\) between 1 and 500',
  'outreach_leads fit_notes CHECK keeps exact length(trim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and conname = 'outreach_leads_fit_notes_check'
  ),
  'fit_notes collate "C" !~',
  'outreach_leads fit_notes CHECK uses COLLATE C control rejection'
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

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_fit_notes_check'
    limit 1
  ) ilike '%business_name%',
  false,
  'fit_notes CHECK stays dedicated (excludes business_name)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Independent cafe with consistent weeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach lead fit_notes is accepted under COLLATE C'
);

select is(
  (E'Independent cafe with consistent\nweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach lead fit_notes is accepted under multiline-aware gate'
);

select is(
  (E'Independent cafe with consistent\tweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach lead fit_notes is accepted under multiline-aware gate'
);

select is(
  (E'Independent cafe with consistent\rweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach lead fit_notes is accepted under multiline-aware gate'
);

select is(
  (E'Independent cafe with consistent\x08weeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach lead fit_notes is rejected under COLLATE C'
);

select is(
  (E'Independent cafe with consistent\x0bweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach lead fit_notes is rejected under COLLATE C'
);

select is(
  (E'Independent cafe with consistent\u007fweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach lead fit_notes is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Independent cafe with consistent weeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent cafe with consistent\nweeknight volume.' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent cafe with consistent\x0bweeknight volume.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent cafe with consistent\u007fweeknight volume.' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach lead fit_notes multiline control detector matches supplier-send allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Independent cafe with consistent\tweeknight volume.'),
      ('Independent cafe with consistent weeknight volume.'),
      (E'Independent cafe with consistent\nweeknight volume.'),
      (E'Independent cafe with consistent\rweeknight volume.'),
      (E'Independent cafe with consistent\x0bweeknight volume.'),
      (E'Independent cafe with consistent\u007fweeknight volume.')
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
    where conrelid = 'public.outreach_leads'::regclass
      and contype = 'c'
      and conname = 'outreach_leads_fit_notes_check'
  ),
  1::bigint,
  'exactly one fit_notes_check constraint is attached'
);

select * from finish();
rollback;
