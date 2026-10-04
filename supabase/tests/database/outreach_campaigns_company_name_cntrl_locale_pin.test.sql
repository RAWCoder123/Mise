-- MISE-005HL: public.outreach_campaigns.company_name CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept company_name bytes the restored
-- C-locale gate would refuse. Sibling campaign name / sender_name /
-- address / audience / value / email / timezone / status CHECKs stay on
-- separate constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_name_check'
  ),
  'outreach_campaigns_company_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_name_check'
  ),
  'char_length\(btrim\(company_name\)\) between 1 and 120',
  'outreach_campaigns company_name CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_name_check'
  ),
  'company_name collate "C" !~ ''[[:cntrl:]]''',
  'outreach_campaigns company_name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_campaigns_name_check'
        or (
          pg_get_constraintdef(oid) ~* '\yname\y'
          and pg_get_constraintdef(oid) not ilike '%company_name%'
          and pg_get_constraintdef(oid) not ilike '%sender_name%'
        )
      )
  ),
  'outreach_campaigns name CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_company_name_check'
    limit 1
  ) ilike '%sender_name%',
  false,
  'company_name CHECK stays dedicated (excludes sender_name)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Mise' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach campaign company_name is accepted under COLLATE C'
);

select is(
  (E'Mise\tCo' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach campaign company_name is rejected under COLLATE C'
);

select is(
  (E'Mise\nCo' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach campaign company_name is rejected under COLLATE C'
);

select is(
  (E'Mise\u007fCo' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach campaign company_name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Mise' collate "C" !~ '[[:cntrl:]]')
    and (E'Mise\tCo' collate "C" ~ '[[:cntrl:]]')
    and (E'Mise\nCo' collate "C" ~ '[[:cntrl:]]')
    and (E'Mise\u007fCo' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach campaign company_name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Mise\tCo'),
      ('Mise'),
      (E'Mise\nCo'),
      (E'Mise\u007fCo')
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
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_name_check'
  ),
  'between 1 and 120',
  'outreach_campaigns company_name CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_company_name_check'
  ),
  1::bigint,
  'exactly one company_name_check constraint is attached'
);

select * from finish();
rollback;
