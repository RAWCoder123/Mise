-- MISE-005CO: restaurant_tasks.origin and required_role CHECKs must keep
-- the exact-token allowlists and pin ASCII shape under COLLATE "C" so
-- dump/restore cannot accept a task-authority identity the restored
-- C-locale gate would refuse.
begin;
select plan(24);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_origin_check'
  ),
  'restaurant_tasks_origin_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_origin_check'
  ),
  'origin in \(''human'', ''mise'', ''automated'', ''approval'', ''verification''\)',
  'restaurant_tasks origin CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_origin_check'
  ),
  'origin collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks origin CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_required_role_check'
  ),
  'restaurant_tasks_required_role_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_required_role_check'
  ),
  'required_role in \(''member'', ''manager'', ''owner_admin''\)',
  'restaurant_tasks required_role CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_tasks'::regclass
      and conname = 'restaurant_tasks_required_role_check'
  ),
  'required_role collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'restaurant_tasks required_role CHECK uses COLLATE C'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('human' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token human matches under COLLATE C'
);

select is(
  ('mise' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token mise matches under COLLATE C'
);

select is(
  ('automated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token automated matches under COLLATE C'
);

select is(
  ('approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token approval matches under COLLATE C'
);

select is(
  ('verification' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token verification matches under COLLATE C'
);

select is(
  ('member' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token member matches under COLLATE C'
);

select is(
  ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manager matches under COLLATE C'
);

select is(
  ('owner_admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token owner_admin matches under COLLATE C'
);

select is(
  ('auto mated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced origin token is rejected under COLLATE C'
);

select is(
  ('owner admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced required_role token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty origin token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty required_role token is rejected under COLLATE C'
);

select is(
  ('human!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated origin token is rejected under COLLATE C'
);

select is(
  ('manager!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated required_role token is rejected under COLLATE C'
);

select is(
  (E'hum\u00e4n' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII origin token is rejected under COLLATE C'
);

select is(
  (E'owner_\u00e4dmin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII required_role token is rejected under COLLATE C'
);

select is(
  ('human' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('mise' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('automated' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('approval' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('verification' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted origin tokens match under COLLATE C'
);

select is(
  ('member' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('owner_admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted required_role tokens match under COLLATE C'
);

select * from finish();
rollback;
