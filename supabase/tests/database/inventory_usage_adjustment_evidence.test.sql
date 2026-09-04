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
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'usage-adjust-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('c0000000-0000-4000-8000-000000000001', 'Usage Adjust Kitchen', 'Fast casual');

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
  'Usage Adjust Supplier',
  'usage adjust supplier'
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
  'Usage Adjust Supplier'
);

select ok(
  exists (
    select 1
    from pg_proc
    where pronamespace = 'private'::regnamespace
      and proname = 'enforce_inventory_usage_adjustment_evidence'
  ),
  'usage/adjustment evidence guard function exists'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'inventory_events_usage_adjustment_evidence'
      and tgrelid = 'public.inventory_events'::regclass
  ),
  'usage/adjustment evidence guard trigger is installed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Seed on-hand with a count so later usage/adjustment projections stay valid.
select ok(
  (public.record_inventory_event(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'count', 2000, 'g', '2026-07-26T10:00:00Z', 'manual_count',
    'usage-adjust-count-1', 'usage-adjust-count-1'
  )).id is not null,
  'manager can seed a count before usage/adjustment evidence checks'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'usage', 100, 'g', '2026-07-26T10:10:00Z', 'operator_usage',
      'usage-bare-1', 'usage-bare-1'
    )
  $sql$),
  false,
  'bare usage without reason is rejected'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'adjustment', -50, 'g', '2026-07-26T10:15:00Z', 'operator_adjustment',
      'adjust-bare-1', 'adjust-bare-1',
      null, 'lost', null, '{}'::jsonb
    )
  $sql$),
  false,
  'bare adjustment without note is rejected'
);

select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'usage', 100, 'g', '2026-07-26T10:20:00Z', 'operator_usage',
      'usage-bad-reason-1', 'usage-bad-reason-1',
      null, 'spoilage', null, jsonb_build_object('note', 'Bad taxonomy')
    )
  $sql$),
  false,
  'usage with a non-allowlisted reason is rejected'
);

select ok(
  (public.record_inventory_event(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'usage', 100, 'g', '2026-07-26T10:25:00Z', 'operator_usage',
    'usage-ok-1', 'usage-ok-1',
    null, 'prep', null, jsonb_build_object('note', 'Prep draw-down')
  )).id is not null,
  'allowlisted usage with note is accepted'
);

select ok(
  (public.record_inventory_event(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000011',
    'adjustment', -25, 'g', '2026-07-26T10:30:00Z', 'operator_adjustment',
    'adjust-ok-1', 'adjust-ok-1',
    null, 'lost', null, jsonb_build_object('note', 'Unexplained loss after check')
  )).id is not null,
  'allowlisted adjustment with note is accepted'
);

reset role;

select * from finish();
rollback;
