-- MISE-005HR: public.outreach_campaigns.value_proposition CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept value-proposition
-- bytes the restored C-locale gate would refuse, while still allowing
-- LF/TAB/CR. Sibling campaign name / company_name / sender_name / postal /
-- audience / email / timezone / status CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_value_proposition_check'
  ),
  'outreach_campaigns_value_proposition_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_value_proposition_check'
  ),
  'char_length\(btrim\(value_proposition\)\) between 1 and 800',
  'outreach_campaigns value_proposition CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_value_proposition_check'
  ),
  'value_proposition collate "C" !~',
  'outreach_campaigns value_proposition CHECK uses COLLATE C control rejection'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and (
        conname = 'outreach_campaigns_audience_description_check'
        or pg_get_constraintdef(oid) ilike '%audience_description%'
      )
  ),
  'outreach_campaigns audience_description CHECK remains attachable'
);

select is(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and contype = 'c'
      and conname = 'outreach_campaigns_value_proposition_check'
    limit 1
  ) ilike '%audience_description%',
  false,
  'value_proposition CHECK stays dedicated (excludes audience_description)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('Cut stockouts and waste without a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach campaign value proposition is accepted under COLLATE C'
);

select is(
  (E'Cut stockouts and waste\nwithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach campaign value proposition is accepted under multiline-aware gate'
);

select is(
  (E'Cut stockouts and waste\twithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach campaign value proposition is accepted under multiline-aware gate'
);

select is(
  (E'Cut stockouts and waste\rwithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach campaign value proposition is accepted under multiline-aware gate'
);

select is(
  (E'Cut stockouts and waste\x08without a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach campaign value proposition is rejected under COLLATE C'
);

select is(
  (E'Cut stockouts and waste\x0bwithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach campaign value proposition is rejected under COLLATE C'
);

select is(
  (E'Cut stockouts and waste\u007fwithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach campaign value proposition is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('Cut stockouts and waste without a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Cut stockouts and waste\nwithout a corporate ops team' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Cut stockouts and waste\x0bwithout a corporate ops team' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'Cut stockouts and waste\u007fwithout a corporate ops team' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach campaign value proposition multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'Cut stockouts and waste\twithout a corporate ops team'),
      ('Cut stockouts and waste without a corporate ops team'),
      (E'Cut stockouts and waste\nwithout a corporate ops team'),
      (E'Cut stockouts and waste\rwithout a corporate ops team'),
      (E'Cut stockouts and waste\x0bwithout a corporate ops team'),
      (E'Cut stockouts and waste\u007fwithout a corporate ops team')
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
      and conname = 'outreach_campaigns_value_proposition_check'
  ),
  1::bigint,
  'exactly one value_proposition_check constraint is attached'
);

select * from finish();
rollback;
