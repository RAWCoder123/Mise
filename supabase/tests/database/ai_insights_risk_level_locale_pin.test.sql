-- MISE-005DI: ai_insights.risk_level CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept an AI insight severity identity the
-- restored C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_risk_level_check'
  ),
  'ai_insights_risk_level_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_risk_level_check'
  ),
  'risk_level in \(''low'', ''medium'', ''high''\)',
  'ai_insights risk_level CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.ai_insights'::regclass
      and conname = 'ai_insights_risk_level_check'
  ),
  'risk_level collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'ai_insights risk_level CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token low matches under COLLATE C'
);

select is(
  ('medium' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token medium matches under COLLATE C'
);

select is(
  ('high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token high matches under COLLATE C'
);

select is(
  ('has low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced risk_level token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty risk_level token is rejected under COLLATE C'
);

select is(
  ('low!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated risk_level token is rejected under COLLATE C'
);

select is(
  (E'l\u00f6w' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII risk_level token is rejected under COLLATE C'
);

select is(
  ('low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('medium' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted risk_level tokens match under COLLATE C'
);

select * from finish();
rollback;
