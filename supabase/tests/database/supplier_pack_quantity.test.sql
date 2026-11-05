-- Manager pack verification and planning snapshot pack payload.

begin;
select plan(10);

select has_function(
  'public',
  'verify_supplier_item_pack_quantity',
  array['uuid', 'uuid', 'numeric'],
  'pack verification RPC exists'
);

select function_privs_are(
  'public',
  'verify_supplier_item_pack_quantity',
  array['uuid', 'uuid', 'numeric'],
  'authenticated',
  array['EXECUTE'],
  'authenticated can execute pack verification'
);

select function_privs_are(
  'public',
  'verify_supplier_item_pack_quantity',
  array['uuid', 'uuid', 'numeric'],
  'anon',
  array[]::text[],
  'anon cannot execute pack verification'
);

-- Tenant fixtures reuse shared helpers when available; fall back to lightweight setup.
insert into auth.users (id, email)
values
  ('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner-pack@example.com'),
  ('bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'staff-pack@example.com')
on conflict (id) do nothing;

insert into public.restaurants (id, name, timezone, currency)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Pack Cafe', 'America/New_York', 'USD')
on conflict (id) do nothing;

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner', 'active'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'staff', 'active')
on conflict do nothing;

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Case Foods',
  'case foods'
)
on conflict (id) do nothing;

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level, reorder_threshold,
  estimated_unit_cost, supplier_id, supplier_name, last_updated,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Chicken thighs',
  'Protein',
  'lbs',
  4,
  24,
  8,
  3.5,
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Case Foods',
  now(),
  'g',
  453.59237,
  'verified',
  now(),
  'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
)
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbb1-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.verify_supplier_item_pack_quantity(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    10
  )$$,
  '42501',
  'Not authorized for this restaurant',
  'staff cannot verify supplier packs'
);

select set_config('request.jwt.claim.sub', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select lives_ok(
  $$select public.verify_supplier_item_pack_quantity(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    10
  )$$,
  'owner can verify supplier packs'
);

select results_eq(
  $$select pack_quantity::int, verification_status
    from public.supplier_items
    where restaurant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and inventory_item_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'$$,
  $$values (10, 'verified')$$,
  'verified pack quantity is stored on supplier_items'
);

reset role;

select ok(
  exists (
    select 1 from public.audit_logs
    where restaurant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      and action = 'supplier_item.pack_quantity_verified'
  ),
  'pack verification writes an audit log'
);

select set_config('request.jwt.claim.sub', 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
set local role service_role;

select ok(
  (
    select jsonb_path_exists(
      public.service_fetch_operational_planning_snapshot(
        'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      ),
      '$.verifiedSupplierPacks[*] ? (@.inventoryItemId == "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" && @.packQuantity == 10)'
    )
  ),
  'planning snapshot includes verified supplier packs'
);

select throws_ok(
  $$select public.verify_supplier_item_pack_quantity(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    0
  )$$,
  '22023',
  'Pack quantity is invalid',
  'zero pack quantity is rejected'
);

select * from finish();
rollback;
