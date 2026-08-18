-- Database-level concurrency regressions for authoritative inventory counts.

create extension if not exists dblink with schema extensions;

select plan(14);

create or replace function pg_temp.wait_for_dblink_busy(connection_name text)
returns boolean
language plpgsql
as $$
declare
  deadline timestamptz := clock_timestamp() + interval '2 seconds';
begin
  loop
    if extensions.dblink_is_busy(connection_name) = 1 then
      return true;
    end if;
    if clock_timestamp() >= deadline then
      return false;
    end if;
    perform pg_sleep(0.01);
  end loop;
end;
$$;

create or replace function pg_temp.run_same_item_race(
  item_id uuid,
  delayed_event_type text,
  delayed_quantity numeric,
  delayed_effective_at timestamptz,
  count_quantity numeric,
  count_effective_at timestamptz,
  event_prefix text
)
returns void
language plpgsql
as $$
declare
  count_connection text := event_prefix || '_count';
  delayed_connection text := event_prefix || '_delayed';
  insert_status text;
begin
  perform extensions.dblink_connect(count_connection, 'dbname=' || current_database());
  perform extensions.dblink_connect(delayed_connection, 'dbname=' || current_database());
  perform extensions.dblink_exec(count_connection, 'begin');
  perform extensions.dblink_exec(
    count_connection,
    format(
      'insert into public.inventory_events (restaurant_id, inventory_item_id, event_type, quantity, canonical_unit, effective_at, actor_user_id, source, client_event_id, idempotency_key) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      'f1000000-0000-4000-8000-000000000002', item_id, 'count', count_quantity, 'each', count_effective_at,
      'f1000000-0000-4000-8000-000000000001', 'test_fixture', event_prefix || '-count', event_prefix || '-count'
    )
  );
  if extensions.dblink_send_query(
    delayed_connection,
    format(
      'insert into public.inventory_events (restaurant_id, inventory_item_id, event_type, quantity, canonical_unit, effective_at, actor_user_id, source, client_event_id, idempotency_key) values (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L)',
      'f1000000-0000-4000-8000-000000000002', item_id, delayed_event_type, delayed_quantity, 'each', delayed_effective_at,
      'f1000000-0000-4000-8000-000000000001', 'test_fixture', event_prefix || '-delayed', event_prefix || '-delayed'
    )
  ) <> 1 then
    raise exception 'Could not dispatch concurrent inventory event';
  end if;
  if not pg_temp.wait_for_dblink_busy(delayed_connection) then
    raise exception 'Concurrent inventory event did not wait on the item lock';
  end if;
  perform extensions.dblink_exec(count_connection, 'commit');
  select status into insert_status
  from extensions.dblink_get_result(delayed_connection) as result(status text);
  if insert_status <> 'INSERT 0 1' then
    raise exception 'Concurrent inventory event failed: %', insert_status;
  end if;
  perform extensions.dblink_disconnect(count_connection);
  perform extensions.dblink_disconnect(delayed_connection);
end;
$$;

create or replace function pg_temp.run_independent_item_race()
returns void
language plpgsql
as $$
begin
  perform extensions.dblink_connect('projection_held_item', 'dbname=' || current_database());
  perform extensions.dblink_connect('projection_independent_item', 'dbname=' || current_database());
  perform extensions.dblink_exec('projection_held_item', 'begin');
  perform extensions.dblink_exec('projection_independent_item', 'set lock_timeout = ''500ms''');
  perform extensions.dblink_exec(
    'projection_held_item',
    'insert into public.inventory_events (restaurant_id, inventory_item_id, event_type, quantity, canonical_unit, effective_at, actor_user_id, source, client_event_id, idempotency_key) values (''f1000000-0000-4000-8000-000000000002'', ''f1000000-0000-4000-8000-000000000015'', ''count'', 10, ''each'', ''2020-01-01T13:00:00Z'', ''f1000000-0000-4000-8000-000000000001'', ''test_fixture'', ''independent-held-count'', ''independent-held-count'')'
  );
  perform extensions.dblink_exec(
    'projection_independent_item',
    'insert into public.inventory_events (restaurant_id, inventory_item_id, event_type, quantity, canonical_unit, effective_at, actor_user_id, source, client_event_id, idempotency_key) values (''f1000000-0000-4000-8000-000000000002'', ''f1000000-0000-4000-8000-000000000016'', ''receipt'', 5, ''each'', ''2020-01-01T12:00:00Z'', ''f1000000-0000-4000-8000-000000000001'', ''test_fixture'', ''independent-receipt'', ''independent-receipt'')'
  );
  perform extensions.dblink_exec('projection_held_item', 'commit');
  perform extensions.dblink_disconnect('projection_held_item');
  perform extensions.dblink_disconnect('projection_independent_item');
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'f1000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'projection-concurrency@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('f1000000-0000-4000-8000-000000000002', 'Projection Concurrency Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'manager', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status
)
values
  ('f1000000-0000-4000-8000-000000000011', 'f1000000-0000-4000-8000-000000000002', 'Sequential', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000012', 'f1000000-0000-4000-8000-000000000002', 'Delayed receipt', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000013', 'f1000000-0000-4000-8000-000000000002', 'Post-count receipt', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000014', 'f1000000-0000-4000-8000-000000000002', 'Backdated count', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000015', 'f1000000-0000-4000-8000-000000000002', 'Held item', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000016', 'f1000000-0000-4000-8000-000000000002', 'Independent item', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified'),
  ('f1000000-0000-4000-8000-000000000017', 'f1000000-0000-4000-8000-000000000002', 'Replay item', 'Test', 'each', 1, 20, 5, 1, 'Test', 'each', 1, 'verified');

insert into public.inventory_events (
  restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
)
values
  ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000011', 'count', 10, 'each', '2020-01-01T13:00:00Z', 'f1000000-0000-4000-8000-000000000001', 'test_fixture', 'sequential-count', 'sequential-count'),
  ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000011', 'receipt', 5, 'each', '2020-01-01T12:00:00Z', 'f1000000-0000-4000-8000-000000000001', 'test_fixture', 'sequential-delayed', 'sequential-delayed');

select is(
  (select current_quantity from public.inventory_items where id = 'f1000000-0000-4000-8000-000000000011'),
  10::numeric,
  'a sequential delayed receipt does not move the counted projection'
);
select is(
  (select projection_applied from public.inventory_events where client_event_id = 'sequential-delayed'),
  false,
  'a sequential delayed receipt remains in history as unapplied'
);

select lives_ok(
  $$select pg_temp.run_same_item_race('f1000000-0000-4000-8000-000000000012', 'receipt', 5, '2020-01-01T12:00:00Z', 10, '2020-01-01T13:00:00Z', 'concurrent-delayed')$$,
  'a delayed receipt waits for the concurrent count decision'
);
select is(
  (select current_quantity from public.inventory_items where id = 'f1000000-0000-4000-8000-000000000012'),
  10::numeric,
  'a concurrent delayed receipt cannot apply on top of the count'
);
select is(
  (select projection_applied from public.inventory_events where client_event_id = 'concurrent-delayed-delayed'),
  false,
  'the concurrent delayed receipt records the audited unapplied decision'
);

select lives_ok(
  $$select pg_temp.run_same_item_race('f1000000-0000-4000-8000-000000000013', 'receipt', 5, '2020-01-01T14:00:00Z', 10, '2020-01-01T13:00:00Z', 'concurrent-post-count')$$,
  'a post-count receipt waits for the concurrent count decision'
);
select is(
  (select current_quantity from public.inventory_items where id = 'f1000000-0000-4000-8000-000000000013'),
  15::numeric,
  'a genuine post-count receipt applies exactly once'
);
select is(
  (select projection_applied from public.inventory_events where client_event_id = 'concurrent-post-count-delayed'),
  true,
  'the post-count receipt is recorded as applied'
);

select lives_ok(
  $$select pg_temp.run_same_item_race('f1000000-0000-4000-8000-000000000014', 'count', 7, '2020-01-01T12:00:00Z', 10, '2020-01-01T13:00:00Z', 'concurrent-counts')$$,
  'a backdated count waits for the newer concurrent count decision'
);
select is(
  (select current_quantity from public.inventory_items where id = 'f1000000-0000-4000-8000-000000000014'),
  10::numeric,
  'two concurrent counts retain the newer authoritative count deterministically'
);
select is(
  (select projection_applied from public.inventory_events where client_event_id = 'concurrent-counts-delayed'),
  false,
  'the backdated concurrent count is retained without moving on-hand'
);

select lives_ok(
  $$select pg_temp.run_independent_item_race()$$,
  'an event for a different item completes while another item is locked'
);
select is(
  (select current_quantity from public.inventory_items where id = 'f1000000-0000-4000-8000-000000000016'),
  6::numeric,
  'different inventory items do not share one global lock'
);

set role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select is(
  (public.record_inventory_event(
    'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000017', 'count', 10, 'each',
    '2020-01-01T13:00:00Z', 'manual_count', 'concurrent-replay', 'concurrent-replay'
  )).id,
  (public.record_inventory_event(
    'f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000017', 'count', 10, 'each',
    '2020-01-01T13:00:00Z', 'manual_count', 'concurrent-replay', 'concurrent-replay'
  )).id,
  'an idempotent replay still returns the original event'
);
reset role;

select * from finish();

delete from public.restaurants where id = 'f1000000-0000-4000-8000-000000000002';
delete from auth.users where id = 'f1000000-0000-4000-8000-000000000001';