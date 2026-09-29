-- MISE-005CQ: restaurant_tasks.operational_category CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a task-category identity the restored
-- C-locale gate would refuse.
begin;
select plan(19);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_operational_category_check'
  ),
  'restaurant_tasks_operational_category_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_operational_category_check'
  ),
  'operational_category in \(''inventory'', ''orders'', ''prep'', ''service'', ''team'', ''cleaning'', ''maintenance'', ''deliveries'', ''closing'', ''integrations'', ''other''\)',
  'restaurant_tasks operational_category CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_operational_category_check'
  ),
  'operational_category collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks operational_category CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token inventory matches under COLLATE C'
);

select is(
  ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token orders matches under COLLATE C'
);

select is(
  ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token prep matches under COLLATE C'
);

select is(
  ('service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token service matches under COLLATE C'
);

select is(
  ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token team matches under COLLATE C'
);

select is(
  ('cleaning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cleaning matches under COLLATE C'
);

select is(
  ('maintenance' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token maintenance matches under COLLATE C'
);

select is(
  ('deliveries' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token deliveries matches under COLLATE C'
);

select is(
  ('closing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token closing matches under COLLATE C'
);

select is(
  ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token integrations matches under COLLATE C'
);

select is(
  ('other' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token other matches under COLLATE C'
);

select is(
  ('in ventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced operational_category token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty operational_category token is rejected under COLLATE C'
);

select is(
  ('inventory!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated operational_category token is rejected under COLLATE C'
);

select is(
  (E'invent\u00f6ry' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII operational_category token is rejected under COLLATE C'
);

select is(
  ('inventory' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('orders' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('prep' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('service' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('team' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cleaning' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('maintenance' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('deliveries' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('closing' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('integrations' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('other' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted operational_category tokens match under COLLATE C'
);

select * from finish();
rollback;
