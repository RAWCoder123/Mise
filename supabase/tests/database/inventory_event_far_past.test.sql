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
    'f1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'far-past-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('f0000000-0000-4000-8000-000000000001', 'Far Past Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'f0000000-0000-4000-8000-000000000001',
  'f1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'f0000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000001',
  'Far Past Supplier',
  'far past supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000001',
  'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
  'f0000000-0000-4000-8000-000000000010',
  'Far Past Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'reject_far_past_inventory_event'
  ),
  'far-past inventory event guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'reject_far_past_inventory_event'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'far-past inventory event guard trigger is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 day', 'operator_receipt',
    'far-past-recent-receipt-1', 'far-past-recent-receipt-1'
  )).id is not null,
  'a receipt effective one day ago remains accepted'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now() - interval '91 days', 'operator_receipt',
      'far-past-receipt-1', 'far-past-receipt-1'
    )
  $sql$),
  'Inventory ledger events cannot be effective more than 90 days in the past',
  'a receipt effective more than 90 days ago is rejected'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'waste', 5, 'g', now() - interval '120 days', 'operator_waste',
      'far-past-waste-1', 'far-past-waste-1'
    )
  $sql$),
  'Inventory ledger events cannot be effective more than 90 days in the past',
  'a waste event effective more than 90 days ago is rejected'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'count', 1000, 'g', now() - interval '91 days', 'manual_count',
      'far-past-count-1', 'far-past-count-1'
    )
  $sql$),
  'Inventory ledger events cannot be effective more than 90 days in the past',
  'a count effective more than 90 days ago is rejected'
);

reset role;

select * from finish();
rollback;
