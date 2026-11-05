begin;

select plan(8);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
as $$
begin
  execute statement;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function pg_temp.execute_error(statement text)
returns text
language plpgsql
security invoker
as $$
begin
  execute statement;
  return null;
exception
  when others then
    return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'zero-qty-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('a0000000-0000-4000-8000-000000000001', 'Zero Qty Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'a0000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000001',
  'Zero Qty Supplier',
  'zero qty supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000001',
  'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
  'a0000000-0000-4000-8000-000000000010',
  'Zero Qty Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'reject_zero_quantity_inventory_event'
  ),
  'zero-quantity inventory event guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'reject_zero_quantity_inventory_event'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'zero-quantity inventory event guard trigger is installed'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_events_nonzero_movement_check'
      and conrelid = 'public.inventory_events'::regclass
  ),
  'zero-quantity movement CHECK constraint is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 hour', 'operator_receipt',
    'zero-qty-positive-receipt-1', 'zero-qty-positive-receipt-1'
  )).id is not null,
  'a positive receipt remains accepted'
);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'count', 0, 'g', now() - interval '1 hour', 'operator_count',
    'zero-qty-count-0', 'zero-qty-count-0'
  )).id is not null,
  'a zero count observation remains accepted'
);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'stockout', 0, 'g', now() - interval '1 hour', 'operator_stockout',
    'zero-qty-stockout-0', 'zero-qty-stockout-0'
  )).id is not null,
  'an explicit stockout zero remains accepted'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'receipt', 0, 'g', now() - interval '1 hour', 'operator_receipt',
      'zero-qty-receipt-0', 'zero-qty-receipt-0'
    )
  $sql$),
  'Inventory ledger events other than count and stockout cannot have a zero quantity',
  'zero-quantity receipt fails closed'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'waste', 0, 'g', now() - interval '1 hour', 'operator_waste',
      'zero-qty-waste-0', 'zero-qty-waste-0'
    )
  $sql$),
  'Inventory ledger events other than count and stockout cannot have a zero quantity',
  'zero-quantity waste fails closed'
);

select * from finish();
rollback;
