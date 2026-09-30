-- MISE-005DV: purchase_recommendations.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a recommendation-status token the restored
-- C-locale gate would refuse.
begin;
select plan(12);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_status_check'
  ),
  'purchase_recommendations_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_status_check'
  ),
  'status in \(''pending'', ''approved'', ''dismissed'', ''ordered''\)',
  'purchase_recommendations status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.purchase_recommendations'::regclass
      and conname = 'purchase_recommendations_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'purchase_recommendations status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('pending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token pending matches under COLLATE C'
);

select is(
  ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approved matches under COLLATE C'
);

select is(
  ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token dismissed matches under COLLATE C'
);

select is(
  ('ordered' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ordered matches under COLLATE C'
);

select is(
  ('pending approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('approved!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'approv\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('pending' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approved' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('dismissed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ordered' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
