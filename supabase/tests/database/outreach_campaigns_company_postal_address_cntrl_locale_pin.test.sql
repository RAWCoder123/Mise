-- MISE-005HP: public.outreach_campaigns.company_postal_address CHECK must keep
-- its exact char_length(btrim) bound and pin multiline-aware ASCII control
-- rejection under COLLATE "C" so dump/restore cannot accept address bytes the
-- restored C-locale gate would refuse, while still allowing LF/TAB/CR.
-- Sibling campaign name / company_name / sender_name / audience / value /
-- email / timezone / status CHECKs stay on separate constraints.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_postal_address_check'
  ),
  'outreach_campaigns_company_postal_address_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_postal_address_check'
  ),
  'char_length\(btrim\(company_postal_address\)\) between 8 and 500',
  'outreach_campaigns company_postal_address CHECK keeps exact char_length(btrim) bound'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_company_postal_address_check'
  ),
  'company_postal_address collate "C" !~',
  'outreach_campaigns company_postal_address CHECK uses COLLATE C control rejection'
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
      and conname = 'outreach_campaigns_company_postal_address_check'
    limit 1
  ) ilike '%company_name%',
  false,
  'company_postal_address CHECK stays dedicated (excludes company_name)'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('123 Main St, Austin TX 78701' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'printable outreach campaign postal address is accepted under COLLATE C'
);

select is(
  (E'123 Main St\nAustin, TX 78701' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'LF in outreach campaign postal address is accepted under multiline-aware gate'
);

select is(
  (E'123 Main St\tSuite 4' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'TAB in outreach campaign postal address is accepted under multiline-aware gate'
);

select is(
  (E'123 Main St\rAustin, TX 78701' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'CR in outreach campaign postal address is accepted under multiline-aware gate'
);

select is(
  (E'123 Main St\x08Austin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'BS in outreach campaign postal address is rejected under COLLATE C'
);

select is(
  (E'123 Main St\x0bAustin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'VT in outreach campaign postal address is rejected under COLLATE C'
);

select is(
  (E'123 Main St\u007fAustin' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  false,
  'DEL in outreach campaign postal address is rejected under COLLATE C'
);

select is(
  ('' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'empty string has no unsafe multiline controls under COLLATE C'
);

select is(
  ('123 Main St, Austin TX 78701' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'123 Main St\nAustin, TX 78701' collate "C" !~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'123 Main St\x0bAustin' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]')
    and (E'123 Main St\u007fAustin' collate "C" ~ E'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  true,
  'outreach campaign postal address multiline control detector matches allowlist'
);

select is(
  (
    select count(*)
    from (values
      (E'123 Main St\tSuite 4'),
      ('123 Main St, Austin TX 78701'),
      (E'123 Main St\nAustin, TX 78701'),
      (E'123 Main St\rAustin, TX 78701'),
      (E'123 Main St\x0bAustin'),
      (E'123 Main St\u007fAustin')
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
      and conname = 'outreach_campaigns_company_postal_address_check'
  ),
  1::bigint,
  'exactly one company_postal_address_check constraint is attached'
);

select * from finish();
rollback;
