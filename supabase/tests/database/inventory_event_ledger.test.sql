begin;

select plan(15);

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

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'd1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ledger-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ledger-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ledger-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('d0000000-0000-4000-8000-000000000001', 'Ledger Kitchen A', 'Fast casual'),
  ('e0000000-0000-4000-8000-000000000001', 'Ledger Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('d0000000-0000-4000-8000-000000000001', 'd2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('e0000000-0000-4000-8000-000000000001', 'd3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  ('d0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000001', 'Chicken', 'Protein', 'lb', 10, 20, 5, 4, 'Supplier A'),
  ('e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001', 'Coffee', 'Beverage', 'lb', 10, 20, 5, 8, 'Supplier B');

insert into public.inventory_events (
  restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
)
values (
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000011',
  'count', 500, 'g', '2026-07-26T09:00:00Z',
  'd3333333-3333-4333-8333-333333333333',
  'test_fixture', 'tenant-b-event-1', 'tenant-b-event-1'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_inventory_event(uuid,uuid,text,numeric,text,timestamptz,text,text,text,text,text,uuid,jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated operators can call the guarded event RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.record_inventory_event(uuid,uuid,text,numeric,text,timestamptz,text,text,text,text,text,uuid,jsonb)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute the event RPC'
);
select is(
  has_table_privilege('authenticated', 'public.inventory_events', 'INSERT'),
  false,
  'authenticated clients cannot insert inventory events directly'
);
select is(
  has_table_privilege('authenticated', 'public.inventory_events', 'UPDATE'),
  false,
  'authenticated clients cannot update inventory events directly'
);
select is(
  has_table_privilege('authenticated', 'public.inventory_events', 'DELETE'),
  false,
  'authenticated clients cannot delete inventory events directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'count', 1000, 'g', now(), 'manual_count',
      'staff-event-1', 'staff-event-1'
    )
  $sql$),
  false,
  'staff cannot record authoritative inventory events'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'count', 1000, 'g', '2026-07-26T10:00:00Z', 'manual_count',
      'cross-tenant-event-1', 'cross-tenant-event-1'
    )
  $sql$),
  false,
  'a manager cannot record an event for another restaurant'
);
select ok(
  (public.record_inventory_event(
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    'count', 1000, 'g', '2026-07-26T10:00:00Z', 'manual_count',
    'manager-event-1', 'manager-event-1'
  )).id is not null,
  'a manager can record a scoped count'
);
select is(
  (
    public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'count', 1000, 'g', '2026-07-26T10:00:00Z', 'manual_count',
      'manager-event-1', 'manager-event-1'
    )
  ).id,
  (
    select id from public.inventory_events
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and client_event_id = 'manager-event-1'
  ),
  'an identical offline replay returns the authoritative event'
);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000011',
      'count', 999, 'g', '2026-07-26T10:00:00Z', 'manual_count',
      'manager-event-1', 'manager-event-1'
    )
  $sql$),
  false,
  'a changed offline replay surfaces an idempotency conflict'
);
select is(
  (select count(*) from public.inventory_events),
  1::bigint,
  'replays and denied writes create no duplicate tenant-visible events'
);
select is(
  (select count(*) from public.inventory_events where restaurant_id = 'e0000000-0000-4000-8000-000000000001'),
  0::bigint,
  'tenant RLS hides the other restaurant event set'
);
reset role;

select is(
  (select count(*) from public.audit_logs where action = 'inventory_event.recorded'),
  1::bigint,
  'the accepted event records one audit entry'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    update public.inventory_events
    set quantity = 500
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'the append-only trigger blocks privileged updates'
);
select is(
  pg_temp.try_execute($sql$
    delete from public.inventory_events
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'the append-only trigger blocks privileged deletes'
);
reset role;

select * from finish();
rollback;
