-- MISE-005BC: outreach_campaigns.timezone CHECK must reject non-ASCII /
-- control / spaced labels under COLLATE "C" so restore cannot accept timezone
-- bytes the Edge IANA shape gate would refuse (and vice versa).
begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_timezone_check'
  ),
  'outreach_campaigns_timezone_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_timezone_check'
  ),
  'timezone collate "C" ~ ''\^\[A-Za-z0-9/_+-\]\{1,64\}\$''',
  'outreach_campaigns.timezone CHECK uses COLLATE C IANA ASCII shape'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%char_length(timezone)%'
      and pg_get_constraintdef(oid) not ilike '%length(timezone)%'
    from pg_constraint
    where conrelid = 'public.outreach_campaigns'::regclass
      and conname = 'outreach_campaigns_timezone_check'
  ),
  true,
  'outreach_campaigns.timezone CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII controls.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('America/New_York' collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'),
  true,
  'America/New_York matches under COLLATE C'
);

select is(
  ('Etc/GMT+5' collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'),
  true,
  'Etc/GMT+5 matches under COLLATE C'
);

select is(
  ('America/New York' collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'),
  false,
  'spaced timezone label is rejected under COLLATE C'
);

select is(
  (E'America/New_York\t' collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'),
  false,
  'ASCII tab timezone is rejected under COLLATE C'
);

select is(
  ('America/São_Paulo' collate "C" ~ '^[A-Za-z0-9/_+-]{1,64}$'),
  false,
  'non-ASCII timezone label is rejected under COLLATE C'
);

select * from finish();
rollback;
