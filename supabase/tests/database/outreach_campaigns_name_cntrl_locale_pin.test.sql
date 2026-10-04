-- MISE-005HN: public.outreach_campaigns.name CHECK must keep its
-- exact char_length(btrim) bound and pin ASCII control rejection under
-- COLLATE "C" so dump/restore cannot accept campaign-title bytes the restored
-- C-locale gate would refuse. Sibling company_name / sender_name / address /
-- audience / value / email / timezone / status CHECKs stay on separate
-- constraints.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_name_check'
  ),
  'outreach_campaigns_name_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_name_check'
  ),
  'char_length\(btrim\(name\)\) between 1 and 160',
  'outreach_campaigns name CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_name_check'
  ),
  'name collate "C" !~ ''[[:cntrl:]]''',
  'outreach_campaigns name CHECK uses COLLATE C cntrl rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_campaigns_company_name_check'
        or pg_get_constraintdef(oid) ilike '%company_name%'
      )
  ),
  'outreach_campaigns company_name CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_name_check'
    limit 1
  ) ilike '%sender_name%',
  false,
  'name CHECK stays dedicated (excludes sender_name)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Pilot Launch' collate "C" !~ '[[:cntrl:]]'),
  true,
  'printable outreach campaign name is accepted under COLLATE C'
);

select is(
  (E'Pilot\tLaunch' collate "C" !~ '[[:cntrl:]]'),
  false,
  'tab in outreach campaign name is rejected under COLLATE C'
);

select is(
  (E'Pilot\nLaunch' collate "C" !~ '[[:cntrl:]]'),
  false,
  'newline in outreach campaign name is rejected under COLLATE C'
);

select is(
  (E'Pilot\u007fLaunch' collate "C" !~ '[[:cntrl:]]'),
  false,
  'DEL in outreach campaign name is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ '[[:cntrl:]]'),
  true,
  'empty string has no control characters under COLLATE C'
);

select is(
  ('Pilot Launch' collate "C" !~ '[[:cntrl:]]')
    and (E'Pilot\tLaunch' collate "C" ~ '[[:cntrl:]]')
    and (E'Pilot\nLaunch' collate "C" ~ '[[:cntrl:]]')
    and (E'Pilot\u007fLaunch' collate "C" ~ '[[:cntrl:]]'),
  true,
  'outreach campaign name control detector matches ASCII C [[:cntrl:]]'
);

select is(
  (
    select count(*)
    from (values
      (E'Pilot\tLaunch'),
      ('Pilot Launch'),
      (E'Pilot\nLaunch'),
      (E'Pilot\u007fLaunch')
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
      and conname = 'outreach_campaigns_name_check'
  ),
  'between 1 and 160',
  'outreach_campaigns name CHECK keeps original length window'
);

select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_name_check'
  ),
  1::bigint,
  'exactly one name_check constraint is attached'
);

select * from finish();
rollback;
