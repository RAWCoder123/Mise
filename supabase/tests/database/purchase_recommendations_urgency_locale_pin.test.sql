-- MISE-005DW: purchase_recommendations.urgency CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a recommendation-urgency token the restored
-- C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_urgency_check'
  ),
  'purchase_recommendations_urgency_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_urgency_check'
  ),
  'urgency in \(''low'', ''medium'', ''high''\)',
  'purchase_recommendations urgency CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_urgency_check'
  ),
  'urgency collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_recommendations urgency CHECK uses COLLATE C'
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
  ('medium high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced urgency token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty urgency token is rejected under COLLATE C'
);

select is(
  ('high!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated urgency token is rejected under COLLATE C'
);

select is(
  (E'h\u00efgh' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII urgency token is rejected under COLLATE C'
);

select is(
  ('low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('medium' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted urgency tokens match under COLLATE C'
);

select * from finish();
rollback;
