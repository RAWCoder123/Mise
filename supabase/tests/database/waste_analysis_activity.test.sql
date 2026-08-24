begin;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'waste-owner@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Waste Analysis Kitchen',
  'Fast casual',
  'America/New_York'
);

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'a0000000-0000-4000-8000-000000000001',
  'a1111111-1111-4111-8111-111111111111',
  'owner',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000001',
  'Metro Produce', 'metro produce'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000001',
  'Bell peppers', 'Produce', 'lb', 20, 30, 8, 2.35,
  'a0000000-0000-4000-8000-000000000010', 'Metro Produce'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'waste', 453.59237, 'g', '2026-08-01T20:00:00Z', 'manual_waste',
    'waste-event-1', 'waste-event-1', null, 'trim_loss', null,
    '{"note":"Trim loss after prep"}'::jsonb
  )).id is not null,
  'an owner can append the first authoritative waste event'
);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'waste', 226.796185, 'g', '2026-08-03T20:00:00Z', 'manual_waste',
    'waste-event-2', 'waste-event-2', null, 'trim_loss', null,
    '{"note":"Repeated close trim"}'::jsonb
  )).id is not null,
  'a second operating-day waste event is accepted'
);

select is(
  (
    select event_type from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-1')
    )
  ),
  'waste_analysis_completed',
  'waste ledger evidence becomes an explicit waste-analysis activity'
);

select is(
  (
    select category from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-1')
    )
  ),
  'waste',
  'waste activity uses the dedicated operator category'
);

select is(
  (
    select requires_attention from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-1')
    )
  ),
  false,
  'one recorded operating day does not fabricate a repeated pattern'
);

select ok(
  (
    select requires_attention and title = 'Waste pattern needs review'
    from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-2')
    )
  ),
  'waste on a second distinct operating day becomes reviewable'
);

select is(
  (
    select (metadata->>'recentWasteDays')::integer
    from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-2')
    )
  ),
  2,
  'repeated-waste activity preserves the deterministic day count'
);

select ok(
  (
    select evidence_references @> jsonb_build_array(jsonb_build_object(
      'id', (select id from public.inventory_events where client_event_id = 'waste-event-2')
    ))
    from public.activity_events
    where idempotency_key = format(
      'inventory_event:%s',
      (select id from public.inventory_events where client_event_id = 'waste-event-2')
    )
  ),
  'activity evidence points to the exact immutable inventory event'
);

select (public.record_inventory_event(
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000011',
  'waste', 226.796185, 'g', '2026-08-03T20:00:00Z', 'manual_waste',
  'waste-event-2', 'waste-event-2', null, 'trim_loss', null,
  '{"note":"Repeated close trim"}'::jsonb
)).id;

reset role;

select is(
  (
    select count(*) from public.activity_events
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and event_type = 'waste_analysis_completed'
  ),
  2::bigint,
  'an identical inventory-event replay creates no duplicate waste activity'
);

select * from finish();
rollback;
