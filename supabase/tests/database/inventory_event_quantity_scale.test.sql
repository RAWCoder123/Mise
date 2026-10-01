begin;

select plan(6);

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
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'qty-scale-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('c0000000-0000-4000-8000-000000000001', 'Quantity Scale Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'c0000000-0000-4000-8000-000000000001',
  'c1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'c0000000-0000-4000-8000-000000000010',
  'c0000000-0000-4000-8000-000000000001',
  'Quantity Scale Supplier',
  'quantity scale supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'c0000000-0000-4000-8000-000000000011',
  'c0000000-0000-4000-8000-000000000001',
  'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
  'c0000000-0000-4000-8000-000000000010',
  'Quantity Scale Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'reject_oversized_inventory_event_quantity_scale'
  ),
  'oversized inventory event quantity scale guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'reject_oversized_inventory_event_quantity_scale'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'oversized inventory event quantity scale guard trigger is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'receipt', 0.035274, 'g', now() - interval '1 hour',
    'operator_receipt',
    'qty-scale-boundary-accept',
    'qty-scale-boundary-accept'
  )).id is not null,
  'a quantity with exactly 6 decimal places remains accepted'
);

select ok(
  (public.record_inventory_event(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 hour',
    'operator_receipt',
    'qty-scale-integer-accept',
    'qty-scale-integer-accept'
  )).id is not null,
  'an integer quantity remains accepted'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'receipt', 0.1234567, 'g', now() - interval '1 hour',
      'operator_receipt',
      'qty-scale-oversized-reject',
      'qty-scale-oversized-reject'
    )
  $sql$),
  'Inventory event quantity scale exceeds supported limits',
  'a quantity with 7 decimal places fails closed with a terminal message'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'adjustment', -1.0000001, 'g', now() - interval '1 hour',
      'operator_adjustment',
      'qty-scale-signed-oversized-reject',
      'qty-scale-signed-oversized-reject'
    )
  $sql$),
  'Inventory event quantity scale exceeds supported limits',
  'a signed quantity with 7 decimal places fails closed with a terminal message'
);

select * from finish();
rollback;
