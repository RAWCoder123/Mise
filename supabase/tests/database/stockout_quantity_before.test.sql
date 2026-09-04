begin;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'a1111111-1111-4111-8111-111111111101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'stockout-before-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('b1111111-1111-4111-8111-111111111101', 'Stockout Before Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'b1111111-1111-4111-8111-111111111101',
  'a1111111-1111-4111-8111-111111111101',
  'manager',
  'active'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'c1111111-1111-4111-8111-111111111101',
  'b1111111-1111-4111-8111-111111111101',
  'Stockout Before Supplier',
  'stockout before supplier'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
)
values (
  'd1111111-1111-4111-8111-111111111101',
  'b1111111-1111-4111-8111-111111111101',
  'Chicken',
  'Protein',
  'lb',
  12,
  20,
  8,
  4,
  'c1111111-1111-4111-8111-111111111101',
  'Stockout Before Supplier',
  'g',
  1000,
  'verified',
  now(),
  'a1111111-1111-4111-8111-111111111101'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (
    public.record_inventory_event(
      'b1111111-1111-4111-8111-111111111101',
      'd1111111-1111-4111-8111-111111111101',
      'stockout',
      0,
      'g',
      '2026-09-04T15:00:00Z',
      'operator_stockout',
      'stockout-client-1',
      'inventory:stockout-client-1',
      null,
      null,
      null,
      '{"quantity_before": 999, "canonical_quantity_before": 1, "note": "empty"}'::jsonb
    )
  ).id is not null,
  'manager can record a stockout'
);

select is(
  (
    select metadata->>'quantity_before'
    from public.inventory_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and client_event_id = 'stockout-client-1'
  ),
  '12',
  'server stamps native quantity_before and overwrites client forgery'
);

select is(
  (
    select metadata->>'canonical_quantity_before'
    from public.inventory_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and client_event_id = 'stockout-client-1'
  ),
  '12000',
  'server stamps canonical_quantity_before from verified conversion'
);

select is(
  (
    select metadata->>'note'
    from public.inventory_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and client_event_id = 'stockout-client-1'
  ),
  'empty',
  'client note survives stockout metadata stamp'
);

select is(
  (
    select current_quantity
    from public.inventory_items
    where id = 'd1111111-1111-4111-8111-111111111101'
  ),
  0::numeric,
  'stockout still projects on-hand to zero'
);

select is(
  (
    public.record_inventory_event(
      'b1111111-1111-4111-8111-111111111101',
      'd1111111-1111-4111-8111-111111111101',
      'stockout',
      0,
      'g',
      '2026-09-04T15:00:00Z',
      'operator_stockout',
      'stockout-client-1',
      'inventory:stockout-client-1',
      null,
      null,
      null,
      '{"note": "empty"}'::jsonb
    )
  ).id,
  (
    select id
    from public.inventory_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and client_event_id = 'stockout-client-1'
  ),
  'idempotent stockout replay returns the stamped authoritative event'
);

select is(
  (
    select count(*)::integer
    from public.inventory_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and event_type = 'stockout'
  ),
  1,
  'stockout replay does not insert a second ledger row'
);

select is(
  (
    select summary
    from public.activity_events
    where restaurant_id = 'b1111111-1111-4111-8111-111111111101'
      and event_type = 'inventory_risk_detected'
    order by recorded_at desc
    limit 1
  ),
  'Stockout recorded; prior on-hand was 12000 g.',
  'activity summarizes stamped prior on-hand for stockouts'
);

select * from finish();
rollback;
