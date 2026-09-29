-- MISE-005CL: restaurant_tasks.status CHECK must keep the
-- exact-token allowlist and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a task-lifecycle identity the restored
-- C-locale gate would refuse.
begin;
select plan(14);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_status_check'
  ),
  'restaurant_tasks_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_status_check'
  ),
  'status in \(''waiting'', ''blocked'', ''in_progress'', ''completed'', ''cancelled'', ''could_not_verify''\)',
  'restaurant_tasks status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks status CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('waiting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token waiting matches under COLLATE C'
);

select is(
  ('blocked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token blocked matches under COLLATE C'
);

select is(
  ('in_progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token in_progress matches under COLLATE C'
);

select is(
  ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token completed matches under COLLATE C'
);

select is(
  ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token cancelled matches under COLLATE C'
);

select is(
  ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token could_not_verify matches under COLLATE C'
);

select is(
  ('in progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced status token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty status token is rejected under COLLATE C'
);

select is(
  ('waiting!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated status token is rejected under COLLATE C'
);

select is(
  (E'wa\u00efting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII status token is rejected under COLLATE C'
);

select is(
  ('waiting' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('blocked' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('in_progress' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('completed' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('cancelled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('could_not_verify' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select * from finish();
rollback;
