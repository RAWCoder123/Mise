-- MISE-005CC: restaurant_memberships role/status CHECKs and writer
-- gates must keep the exact-token allowlists and pin ASCII shape under
-- COLLATE "C" so dump/restore cannot accept an authorization identity
-- the restored C-locale gate would refuse.
begin;
select plan(27);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_role_check'
  ),
  'restaurant_memberships_role_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_role_check'
  ),
  'role in \(''owner'', ''admin'', ''manager'', ''staff''\)',
  'role CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_role_check'
  ),
  'role collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'role CHECK uses COLLATE C'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_status_check'
  ),
  'restaurant_memberships_status_check exists'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_status_check'
  ),
  'status in \(''active'', ''invited'', ''disabled''\)',
  'status CHECK keeps exact allowlist'
);

select matches(
  (
    select pg_get_constraintdef(oid)
    from pg_constraint
    where conrelid = 'public.restaurant_memberships'::regclass
      and conname = 'restaurant_memberships_status_check'
  ),
  'status collate "C" ~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'status CHECK uses COLLATE C'
);

select matches(
  pg_get_functiondef('public.add_restaurant_member(uuid, uuid, text)'::regprocedure),
  'p_role collate "C" !~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'add_restaurant_member writer uses COLLATE C shape gate'
);

select matches(
  pg_get_functiondef('public.add_restaurant_member(uuid, uuid, text)'::regprocedure),
  'p_role not in \(''admin'', ''manager'', ''staff''\)',
  'add_restaurant_member writer keeps exact role allowlist'
);

select matches(
  pg_get_functiondef('public.update_restaurant_member(uuid, uuid, text, text)'::regprocedure),
  'p_role collate "C" !~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'update_restaurant_member role writer uses COLLATE C shape gate'
);

select matches(
  pg_get_functiondef('public.update_restaurant_member(uuid, uuid, text, text)'::regprocedure),
  'p_role not in \(''owner'', ''admin'', ''manager'', ''staff''\)',
  'update_restaurant_member writer keeps exact role allowlist'
);

select matches(
  pg_get_functiondef('public.update_restaurant_member(uuid, uuid, text, text)'::regprocedure),
  'p_status collate "C" !~ ''\^\[A-Za-z0-9\._-\]\{1,80\}\$''',
  'update_restaurant_member status writer uses COLLATE C shape gate'
);

select matches(
  pg_get_functiondef('public.update_restaurant_member(uuid, uuid, text, text)'::regprocedure),
  'p_status not in \(''active'', ''disabled''\)',
  'update_restaurant_member writer keeps exact status allowlist'
);

-- Under current en_US.UTF-8, C and database ctype agree on ASCII classes.
-- Sibling drift proof for this cluster lives on normalize_purchase_item_key
-- (MISE-005A). Keep the detector identity check cheap and ASCII-focused.
select is(
  ('owner' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token owner matches under COLLATE C'
);

select is(
  ('admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token admin matches under COLLATE C'
);

select is(
  ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token manager matches under COLLATE C'
);

select is(
  ('staff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token staff matches under COLLATE C'
);

select is(
  ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token active matches under COLLATE C'
);

select is(
  ('invited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token invited matches under COLLATE C'
);

select is(
  ('disabled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'writer token disabled matches under COLLATE C'
);

select is(
  ('own er' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'spaced membership identity token is rejected under COLLATE C'
);

select is(
  ('' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'empty membership identity token is rejected under COLLATE C'
);

select is(
  ('owner!' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'punctuated membership identity token is rejected under COLLATE C'
);

select is(
  (E'own\u00e9r' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  false,
  'non-ASCII membership identity token is rejected under COLLATE C'
);

select is(
  ('owner' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('admin' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('manager' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('staff' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted role tokens match under COLLATE C'
);

select is(
  ('active' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('invited' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$')
    and ('disabled' collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'),
  true,
  'all allowlisted status tokens match under COLLATE C'
);

select is(
  has_function_privilege('authenticated', 'public.add_restaurant_member(uuid, uuid, text)', 'EXECUTE'),
  true,
  'authenticated EXECUTE on add_restaurant_member is preserved'
);

select is(
  has_function_privilege('authenticated', 'public.update_restaurant_member(uuid, uuid, text, text)', 'EXECUTE'),
  true,
  'authenticated EXECUTE on update_restaurant_member is preserved'
);

select * from finish();
rollback;
