-- MISE-005AU: restaurant_tasks.client_task_id CHECK must use COLLATE "C"
-- so dump/restore cannot accept a client identity the restored ASCII
-- C-locale gate would refuse.
begin;
select plan(7);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_client_task_id_check'
  ),
  'restaurant_tasks_client_task_id_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_client_task_id_check'
  ),
  'client_task_id collate "C" ~ ''\^\[A-Za-z0-9:_-\]\{1,200\}\$''',
  'restaurant_tasks client_task_id CHECK uses COLLATE C'
);

select is(
  (
    select pg_get_constraintdef(oid) not ilike '%length%client_task_id%'
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_client_task_id_check'
  ),
  true,
  'restaurant_tasks client_task_id CHECK is not length-only'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  (
    'restaurant-task:1727452800000:a1b2c3d4' collate "C"
      ~ '^[A-Za-z0-9:_-]{1,200}$'
  ),
  true,
  'writer client_task_id restaurant-task mint matches under COLLATE C'
);

select is(
  (
    'task-count-chicken' collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'
  ),
  true,
  'fixture client_task_id hyphenated mint matches under COLLATE C'
);

select is(
  ('restaurant task spaced' collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'),
  false,
  'spaced restaurant-task client_task_id is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9:_-]{1,200}$'),
  false,
  'empty restaurant-task client_task_id is rejected under COLLATE C'
);

select * from finish();
rollback;
