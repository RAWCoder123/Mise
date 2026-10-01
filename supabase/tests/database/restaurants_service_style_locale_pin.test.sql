-- MISE-005EF: restaurants.service_style CHECK must keep the exact-token
-- allowlist and pin ASCII shape under COLLATE "C" so dump/restore cannot
-- accept a service-style identity the restored C-locale gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_service_style_check'
  ),
  'restaurants_service_style_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_service_style_check'
  ),
  'service_style in \(''quick_service'', ''fast_casual'', ''full_service'', ''bar'', ''cafe'', ''ghost_kitchen''\)',
  'restaurants service_style CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurants'::regclass
      and conname = 'restaurants_service_style_check'
  ),
  'service_style collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurants service_style CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('quick_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token quick_service matches under COLLATE C'
);

select is(
  ('fast_casual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token fast_casual matches under COLLATE C'
);

select is(
  ('full_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token full_service matches under COLLATE C'
);

select is(
  ('bar' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token bar matches under COLLATE C'
);

select is(
  ('cafe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cafe matches under COLLATE C'
);

select is(
  ('ghost_kitchen' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token ghost_kitchen matches under COLLATE C'
);

select is(
  ('fast casual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced service_style token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty service_style token is rejected under COLLATE C'
);

select is(
  ('fast_casual!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated service_style token is rejected under COLLATE C'
);

select is(
  (E'fast_casu\u00e1l' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII service_style token is rejected under COLLATE C'
);

select is(
  ('quick_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('fast_casual' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('full_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('bar' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cafe' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('ghost_kitchen' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted service_style tokens match under COLLATE C'
);

select * from finish();
rollback;
