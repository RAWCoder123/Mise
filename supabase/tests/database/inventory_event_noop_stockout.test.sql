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
    'authenticated', 'authenticated', 'noop-stockout-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('f0000000-0000-4000-8000-000000000001', 'Noop Stockout Kitchen', 'Fast casual');

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
  'Noop Supplier',
  'noop supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values
  (
    'f0000000-0000-4000-8000-000000000011',
    'f0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 2, 10, 3, 4,
    'f0000000-0000-4000-8000-000000000010', 'Noop Supplier'
  ),
  (
    'f0000000-0000-4000-8000-000000000012',
    'f0000000-0000-4000-8000-000000000001',
    'Empty Bin', 'Dry', 'lb', 0, 4, 1, 2,
    'f0000000-0000-4000-8000-000000000010', 'Noop Supplier'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000011',
    'stockout', 0, 'g', '2026-11-10T18:00:00Z', 'operator_stockout',
    'noop-stockout-ok-1', 'noop-stockout-ok-1'
  )).id is not null,
  'stockout is accepted when native on-hand is positive'
);

select is(
  (select current_quantity from public.inventory_items where id = 'f0000000-0000-4000-8000-000000000011'),
  0::numeric,
  'accepted stockout projects on-hand to zero'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'stockout', 0, 'g', '2026-11-10T18:05:00Z', 'operator_stockout',
      'noop-stockout-dup-1', 'noop-stockout-dup-1'
    )
  $sql$),
  'On-hand is already zero; stockout would not change inventory',
  'second stockout fails closed when on-hand is already zero'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000012',
      'stockout', 0, 'g', '2026-11-10T18:10:00Z', 'operator_stockout',
      'noop-stockout-empty-1', 'noop-stockout-empty-1'
    )
  $sql$),
  'On-hand is already zero; stockout would not change inventory',
  'stockout against an already-empty item is rejected'
);

select ok(
  (public.record_inventory_event(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000012',
    'count', 0, 'g', '2026-11-10T18:15:00Z', 'manual_count',
    'noop-stockout-count-0', 'noop-stockout-count-0'
  )).id is not null,
  'zero-quantity counts remain valid observations'
);

select is(
  (
    public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      'stockout', 0, 'g', '2026-11-10T18:00:00Z', 'operator_stockout',
      'noop-stockout-ok-1', 'noop-stockout-ok-1'
    )
  ).client_event_id,
  'noop-stockout-ok-1',
  'identical offline stockout replay still returns the existing accepted row'
);

reset role;

select * from finish();
rollback;
