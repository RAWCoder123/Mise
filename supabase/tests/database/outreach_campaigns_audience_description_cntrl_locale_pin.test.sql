-- MISE-005HQ: public.outreach_campaigns.audience_description CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept audience bytes the
-- restored C-locale gate would refuse, while still allowing LF/TAB/CR.
-- Sibling campaign name / company_name / sender_name / postal / value /
-- email / timezone / status CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_audience_description_check'
  ),
  'outreach_campaigns_audience_description_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_audience_description_check'
  ),
  'char_length\(btrim\(audience_description\)\) between 1 and 500',
  'outreach_campaigns audience_description CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_audience_description_check'
  ),
  'audience_description collate "C" !~',
  'outreach_campaigns audience_description CHECK uses COLLATE C control rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_campaigns_value_proposition_check'
        or pg_get_constraintdef(oid) ilike '%value_proposition%'
      )
  ),
  'outreach_campaigns value_proposition CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_audience_description_check'
    limit 1
  ) ilike '%value_proposition%',
  false,
  'audience_description CHECK stays dedicated (excludes value_proposition)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Independent restaurants in Austin with 20-60 seats' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach campaign audience description is accepted under COLLATE C'
);

select is(
  (E'Independent restaurants\nin Austin with 20-60 seats' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach campaign audience description is accepted under multiline-aware gate'
);

select is(
  (E'Independent restaurants\tin Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach campaign audience description is accepted under multiline-aware gate'
);

select is(
  (E'Independent restaurants\rin Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach campaign audience description is accepted under multiline-aware gate'
);

select is(
  (E'Independent restaurants\x08in Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach campaign audience description is rejected under COLLATE C'
);

select is(
  (E'Independent restaurants\x0bin Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach campaign audience description is rejected under COLLATE C'
);

select is(
  (E'Independent restaurants\u007fin Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach campaign audience description is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Independent restaurants in Austin with 20-60 seats' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent restaurants\nin Austin with 20-60 seats' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent restaurants\x0bin Austin' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Independent restaurants\u007fin Austin' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach campaign audience description multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Independent restaurants\tin Austin'),
      ('Independent restaurants in Austin with 20-60 seats'),
      (E'Independent restaurants\nin Austin with 20-60 seats'),
      (E'Independent restaurants\rin Austin'),
      (E'Independent restaurants\x0bin Austin'),
      (E'Independent restaurants\u007fin Austin')
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
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_audience_description_check'
  ),
  1::bigint,
  'exactly one audience_description_check constraint is attached'
);

select * from finish();
rollback;
