begin;

select plan(10);

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
    'authenticated', 'authenticated', 'exact-reverse-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('b0000000-0000-4000-8000-000000000001', 'Exact Reverse Kitchen', 'Fast casual');

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
  'Exact Reverse Supplier',
  'exact reverse supplier'
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
  'Exact Reverse Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'enforce_inventory_correction_exact_reverse'
  ),
  'exact reverse inventory correction guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'inventory_events_correction_exact_reverse'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'exact reverse inventory correction guard trigger is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'count', 2000, 'g', now() - interval '3 hours', 'manual_count',
    'exact-reverse-count-1', 'exact-reverse-count-1'
  )).id is not null,
  'a scoped count remains accepted'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'waste', 50, 'g', now() - interval '2 hours', 'operator_waste',
    'exact-reverse-waste-1', 'exact-reverse-waste-1'
  )).id is not null,
  'a waste movement remains accepted'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now() - interval '90 minutes', 'operator_receipt',
    'exact-reverse-receipt-1', 'exact-reverse-receipt-1'
  )).id is not null,
  'a receipt movement remains accepted'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'correction', 25, 'g', now() - interval '80 minutes', 'operator_correction',
      'exact-reverse-mismatch-1', 'exact-reverse-mismatch-1',
      null, null,
      (
        select id from public.inventory_events
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and client_event_id = 'exact-reverse-waste-1'
      ),
      '{}'::jsonb
    )
  $sql$),
  false,
  'mismatched inventory correction quantities are rejected'
);

select is(
  pg_temp.execute_error($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'correction', 25, 'g', now() - interval '80 minutes', 'operator_correction',
      'exact-reverse-mismatch-2', 'exact-reverse-mismatch-2',
      null, null,
      (
        select id from public.inventory_events
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and client_event_id = 'exact-reverse-waste-1'
      ),
      '{}'::jsonb
    )
  $sql$),
  'Inventory correction quantity must exactly reverse the superseded event',
  'mismatched corrections surface the exact-reverse rejection'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000011',
      'correction', -2000, 'g', now() - interval '70 minutes', 'operator_correction',
      'exact-reverse-count-target', 'exact-reverse-count-target',
      null, null,
      (
        select id from public.inventory_events
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and client_event_id = 'exact-reverse-count-1'
      ),
      '{}'::jsonb
    )
  $sql$),
  false,
  'corrections cannot reverse count events'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'correction', 50, 'g', now() - interval '60 minutes', 'operator_correction',
    'exact-reverse-waste-ok', 'exact-reverse-waste-ok',
    null, null,
    (
      select id from public.inventory_events
      where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
        and client_event_id = 'exact-reverse-waste-1'
    ),
    '{}'::jsonb
  )).id is not null,
  'an exact reverse waste correction is accepted'
);

select ok(
  (public.record_inventory_event(
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000011',
    'correction', -100, 'g', now() - interval '50 minutes', 'operator_correction',
    'exact-reverse-receipt-ok', 'exact-reverse-receipt-ok',
    null, null,
    (
      select id from public.inventory_events
      where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
        and client_event_id = 'exact-reverse-receipt-1'
    ),
    '{}'::jsonb
  )).id is not null,
  'an exact reverse receipt correction is accepted'
);

reset role;

select * from finish();
rollback;
