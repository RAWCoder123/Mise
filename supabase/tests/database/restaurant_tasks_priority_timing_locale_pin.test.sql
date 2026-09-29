-- MISE-005CP: restaurant_tasks.priority and timing_bucket CHECKs must keep
-- the exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a task-schedule identity the restored
-- C-locale gate would refuse.
begin;
select plan(23);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_priority_check'
  ),
  'restaurant_tasks_priority_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_priority_check'
  ),
  'priority in \(''urgent'', ''high'', ''normal'', ''low''\)',
  'restaurant_tasks priority CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_priority_check'
  ),
  'priority collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks priority CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_timing_bucket_check'
  ),
  'restaurant_tasks_timing_bucket_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_timing_bucket_check'
  ),
  'timing_bucket in \(''now'', ''up_next'', ''later''\)',
  'restaurant_tasks timing_bucket CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_timing_bucket_check'
  ),
  'timing_bucket collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks timing_bucket CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('urgent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token urgent matches under COLLATE C'
);

select is(
  ('high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token high matches under COLLATE C'
);

select is(
  ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token normal matches under COLLATE C'
);

select is(
  ('low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token low matches under COLLATE C'
);

select is(
  ('now' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token now matches under COLLATE C'
);

select is(
  ('up_next' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token up_next matches under COLLATE C'
);

select is(
  ('later' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token later matches under COLLATE C'
);

select is(
  ('ur gent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced priority token is rejected under COLLATE C'
);

select is(
  ('up next' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced timing_bucket token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty priority token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty timing_bucket token is rejected under COLLATE C'
);

select is(
  ('urgent!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated priority token is rejected under COLLATE C'
);

select is(
  ('later!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated timing_bucket token is rejected under COLLATE C'
);

select is(
  (E'urg\u00ebnt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII priority token is rejected under COLLATE C'
);

select is(
  (E'up_n\u00ebxt' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII timing_bucket token is rejected under COLLATE C'
);

select is(
  ('urgent' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('high' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('normal' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('low' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted priority tokens match under COLLATE C'
);

select is(
  ('now' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('up_next' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('later' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted timing_bucket tokens match under COLLATE C'
);

select * from finish();
rollback;
