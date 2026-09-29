-- MISE-005CS: restaurant_tasks.service_window CHECK must keep the
-- nullable exact-token allowlist and pin ASCII shape under COLLATE "C"
-- so dump/restore cannot accept a service-window identity the restored
-- C-locale gate would refuse.
begin;
select plan(16);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_service_window_check'
  ),
  'restaurant_tasks_service_window_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_service_window_check'
  ),
  'service_window is null',
  'restaurant_tasks service_window CHECK remains nullable'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_service_window_check'
  ),
  'service_window in \(''before_lunch'', ''before_prep'', ''before_supplier_cutoff'', ''before_dinner_service'', ''during_closing'', ''end_of_day'', ''custom''\)',
  'restaurant_tasks service_window CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_service_window_check'
  ),
  'service_window collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks service_window CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('before_lunch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token before_lunch matches under COLLATE C'
);

select is(
  ('before_prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token before_prep matches under COLLATE C'
);

select is(
  ('before_supplier_cutoff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token before_supplier_cutoff matches under COLLATE C'
);

select is(
  ('before_dinner_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token before_dinner_service matches under COLLATE C'
);

select is(
  ('during_closing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token during_closing matches under COLLATE C'
);

select is(
  ('end_of_day' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token end_of_day matches under COLLATE C'
);

select is(
  ('custom' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token custom matches under COLLATE C'
);

select is(
  ('before lunch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced service_window token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty service_window token is rejected under COLLATE C'
);

select is(
  ('custom!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated service_window token is rejected under COLLATE C'
);

select is(
  (E'cust\u00f6m' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII service_window token is rejected under COLLATE C'
);

select is(
  ('before_lunch' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('before_prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('before_supplier_cutoff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('before_dinner_service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('during_closing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('end_of_day' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('custom' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted service_window tokens match under COLLATE C'
);

select * from finish();
rollback;
