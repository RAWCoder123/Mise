begin;
select plan(8);

-- Reuse the MISE-003A fixture restaurant when present; otherwise skip-safe stubs
-- are not available. This file expects purchase_approval_authority fixtures or
-- an equivalent seeded restaurant with manager membership and one menu item.

select has_function(
  'public',
  'set_menu_item_active',
  array['uuid', 'uuid', 'boolean'],
  'set_menu_item_active exists'
);

select ok(
  pg_get_functiondef('public.set_menu_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%set search_path = ''''%',
  'set_menu_item_active pins empty search_path'
);

select ok(
  pg_get_functiondef('public.set_menu_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%array[''owner'', ''admin'', ''manager'']%',
  'set_menu_item_active is manager+'
);

select ok(
  not has_table_privilege('anon', 'public.menu_items', 'update'),
  'anon cannot update menu_items directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.menu_items', 'update'),
  'authenticated cannot update menu_items directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_menu_item_active(uuid,uuid,boolean)',
    'execute'
  ),
  'authenticated may execute set_menu_item_active'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_menu_item_active(uuid,uuid,boolean)',
    'execute'
  ),
  'anon cannot execute set_menu_item_active'
);

select ok(
  pg_get_functiondef('public.set_menu_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%menu_item_activated%'
    and pg_get_functiondef('public.set_menu_item_active(uuid,uuid,boolean)'::regprocedure)
      like '%menu_item_deactivated%',
  'set_menu_item_active writes activate and deactivate audits'
);

select * from finish();
rollback;
