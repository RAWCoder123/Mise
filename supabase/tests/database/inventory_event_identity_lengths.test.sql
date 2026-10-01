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
    'b1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'identity-len-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('b0000000-0000-4000-8000-000000000001', 'Identity Length Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'b0000000-0000-4000-8000-000000000001',
  'b1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'b0000000-0000-4000-8000-000000000010',
  'b0000000-0000-4000-8000-000000000001',
  'Identity Length Supplier',
  'identity length supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'b0000000-0000-4000-8000-000000000011',
  'b0000000-0000-4000-8000-000000000001',
  'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
  'b0000000-0000-4000-8000-000000000010',
  'Identity Length Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'reject_oversized_inventory_event_identity'
  ),
  'oversized inventory event identity guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'reject_oversized_inventory_event_identity'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'oversized inventory event identity guard trigger is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 hour',
    repeat('s', 80),
    'identity-len-boundary-source',
    'identity-len-boundary-source'
  )).id is not null,
  'an 80-character source remains accepted'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 hour',
    'operator_receipt',
    repeat('c', 200),
    'identity-len-boundary-client-event'
  )).id is not null,
  'a 200-character client_event_id remains accepted'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '1 hour',
    'operator_receipt',
    'identity-len-boundary-idempotency-client',
    repeat('i', 240)
  )).id is not null,
  'a 240-character idempotency_key remains accepted'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now() - interval '1 hour',
      repeat('s', 81),
      'identity-len-oversized-source',
      'identity-len-oversized-source'
    )
  $sql$),
  'Inventory event source is too long',
  'an oversized source fails closed with a terminal message'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now() - interval '1 hour',
      'operator_receipt',
      repeat('c', 201),
      'identity-len-oversized-client-event'
    )
  $sql$),
  'Inventory event client event id is too long',
  'an oversized client_event_id fails closed with a terminal message'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now() - interval '1 hour',
      'operator_receipt',
      'identity-len-oversized-idempotency-client',
      repeat('i', 241)
    )
  $sql$),
  'Inventory event idempotency key is too long',
  'an oversized idempotency_key fails closed with a terminal message'
);

select * from finish();
rollback;
