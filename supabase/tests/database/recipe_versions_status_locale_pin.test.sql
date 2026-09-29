-- MISE-005CH: recipe_versions.status CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a lifecycle-state identity the restored C-locale gate would refuse.
begin;
select plan(11);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.recipe_versions'::regclass
      and conname = 'recipe_versions_status_check'
  ),
  'recipe_versions_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_versions'::regclass
      and conname = 'recipe_versions_status_check'
  ),
  'status in \(''draft'', ''verified'', ''retired''\)',
  'recipe_versions status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.recipe_versions'::regclass
      and conname = 'recipe_versions_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'recipe_versions status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token draft matches under COLLATE C'
);

select is(
  ('verified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token verified matches under COLLATE C'
);

select is(
  ('retired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token retired matches under COLLATE C'
);

select is(
  ('ver ified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('draft!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'retir\u00e9d' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('draft' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('verified' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('retired' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
