begin;
select plan(9);

select has_column(
  'public',
  'inventory_items',
  'active',
  'inventory_items.active exists'
);

select has_function(
  'public',
  'set_inventory_item_active',
  array['uuid', 'uuid', 'boolean'],
  'set_inventory_item_active exists'
);

select ok(
  pg_get_functiondef('public.set_inventory_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%set search_path = ''''%',
  'set_inventory_item_active pins empty search_path'
);

select ok(
  pg_get_functiondef('public.set_inventory_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%array[''owner'', ''admin'', ''manager'']%',
  'set_inventory_item_active is manager+'
);

select ok(
  not has_table_privilege('anon', 'public.inventory_items', 'update'),
  'anon cannot update inventory_items directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.inventory_items', 'update'),
  'authenticated cannot update inventory_items directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_inventory_item_active(uuid,uuid,boolean)',
    'execute'
  ),
  'authenticated may execute set_inventory_item_active'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.set_inventory_item_active(uuid,uuid,boolean)',
    'execute'
  ),
  'anon cannot execute set_inventory_item_active'
);

select ok(
  pg_get_functiondef('public.set_inventory_item_active(uuid,uuid,boolean)'::regprocedure)
    like '%inventory_item_activated%'
    and pg_get_functiondef('public.set_inventory_item_active(uuid,uuid,boolean)'::regprocedure)
      like '%inventory_item_deactivated%',
  'set_inventory_item_active writes activate and deactivate audits'
);

select * from finish();
rollback;
