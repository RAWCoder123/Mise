begin;

select plan(10);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
as $$
begin
  execute statement;
  return true;
exception when others then return false;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('7a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'commit-ready-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'commit-blocked-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('7a333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'commit-outsider@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('7a000000-0000-4000-8000-000000000001', 'Commit Ready Kitchen', 'Cafe', 'UTC'),
  ('7b000000-0000-4000-8000-000000000001', 'Commit Blocked Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('7a000000-0000-4000-8000-000000000001', '7a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('7b000000-0000-4000-8000-000000000001', '7a222222-2222-4222-8222-222222222222', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('7a000000-0000-4000-8000-000000000101', '7a000000-0000-4000-8000-000000000001', 'Ready Produce', 'ready produce'),
  ('7b000000-0000-4000-8000-000000000101', '7b000000-0000-4000-8000-000000000001', 'Blocked Produce', 'blocked produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('7a000000-0000-4000-8000-000000000201', '7a000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 4, 10, 3, 1.5,
   '7a000000-0000-4000-8000-000000000101', 'Ready Produce',
   'each', 1, 'verified', now(), '7a111111-1111-4111-8111-111111111111'),
  ('7b000000-0000-4000-8000-000000000201', '7b000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 4, 10, 3, 1.5,
   '7b000000-0000-4000-8000-000000000101', 'Blocked Produce',
   'each', 1, 'verified', now(), '7a222222-2222-4222-8222-222222222222');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('7a000000-0000-4000-8000-000000000301', '7a000000-0000-4000-8000-000000000001',
   '7a000000-0000-4000-8000-000000000201', 'count', 4, 'each', now(),
   '7a111111-1111-4111-8111-111111111111', 'commit-ready-test', 'ready-count', 'ready-count'),
  ('7b000000-0000-4000-8000-000000000301', '7b000000-0000-4000-8000-000000000001',
   '7b000000-0000-4000-8000-000000000201', 'count', 4, 'each', now(),
   '7a222222-2222-4222-8222-222222222222', 'commit-blocked-test', 'blocked-count', 'blocked-count');

insert into public.pos_integrations (
  id, restaurant_id, provider, status, last_sync_at
) values (
  '7a000000-0000-4000-8000-000000000401', '7a000000-0000-4000-8000-000000000001',
  'manual_csv', 'connected', now()
);

insert into public.menu_items (id, restaurant_id, name, category, active)
values ('7a000000-0000-4000-8000-000000000501', '7a000000-0000-4000-8000-000000000001',
  'Tomato Salad', 'Entree', true);

insert into public.menu_item_ingredients (
  id, restaurant_id, menu_item_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
) values (
  '7a000000-0000-4000-8000-000000000502', '7a000000-0000-4000-8000-000000000001',
  '7a000000-0000-4000-8000-000000000501', 'Tomato Salad',
  '7a000000-0000-4000-8000-000000000201', 1, 'each'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id
)
select
  '7a000000-0000-4000-8000-000000000001', current_date - service_day,
  'Tomato Salad', 'Entree', 2, 20, 18, 'Manual CSV Upload', 'commit-ready-sale-' || service_day
from generate_series(0, 7) service_day;

insert into private.restaurant_signal_state (
  restaurant_id, planning_revision, signals_revision, status
) values
  ('7a000000-0000-4000-8000-000000000001', 3, 2, 'pending'),
  ('7b000000-0000-4000-8000-000000000001', 5, 4, 'pending');

-- Pre-seed a stale system recommendation on the blocked restaurant so the
-- empty commit path can prove it clears pending mise_rules rows.
insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values (
  '7b000000-0000-4000-8000-000000000601', '7b000000-0000-4000-8000-000000000001',
  '7b000000-0000-4000-8000-000000000201', 'Tomatoes',
  '7b000000-0000-4000-8000-000000000101', 'Blocked Produce', 9, 'each',
  'Stale system recommendation before readiness', 'high', 'pending', 'mise_rules', 4
);

select ok(
  (private.evaluate_pilot_can_recommend('7a000000-0000-4000-8000-000000000001')->>'canRecommend')::boolean,
  'ready restaurant evaluates canRecommend true for commit gate'
);
select ok(
  not (private.evaluate_pilot_can_recommend('7b000000-0000-4000-8000-000000000001')->>'canRecommend')::boolean,
  'blocked restaurant evaluates canRecommend false for commit gate'
);

select is(
  (private.commit_operational_signals(
    '7a111111-1111-4111-8111-111111111111',
    '7a000000-0000-4000-8000-000000000001',
    3,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', '7a000000-0000-4000-8000-000000000201',
        'recommended_quantity', 6,
        'reason', 'Ready kitchen needs tomatoes',
        'urgency', 'medium'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'insight_type', 'inventory',
        'title', 'Tomato stock is low',
        'description', 'Counts show tomatoes below par.',
        'why_it_matters', 'Stockouts risk lunch service.',
        'recommended_action', 'Review the draft order.',
        'severity', 'warning'
      )
    ),
    false,
    '{}'::jsonb
  )->>'recommendations')::integer,
  1,
  'ready restaurant persists system recommendations on commit'
);

select is(
  (select count(*)::integer from public.purchase_recommendations
   where restaurant_id = '7a000000-0000-4000-8000-000000000001'
     and status = 'pending'
     and generation_source = 'mise_rules'),
  1,
  'ready commit leaves one pending mise_rules recommendation'
);

select is(
  (private.commit_operational_signals(
    '7a222222-2222-4222-8222-222222222222',
    '7b000000-0000-4000-8000-000000000001',
    5,
    jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', '7b000000-0000-4000-8000-000000000201',
        'recommended_quantity', 11,
        'reason', 'Blocked kitchen must not publish this',
        'urgency', 'high'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'insight_type', 'inventory',
        'title', 'Insight still useful',
        'description', 'Insights remain available before purchasing readiness.',
        'why_it_matters', null,
        'recommended_action', 'Finish POS and recipe setup.',
        'severity', 'info'
      )
    ),
    false,
    '{}'::jsonb
  )->>'recommendations')::integer,
  0,
  'blocked restaurant publishes zero system recommendations on commit'
);

select is(
  (select count(*)::integer from public.purchase_recommendations
   where restaurant_id = '7b000000-0000-4000-8000-000000000001'
     and status = 'pending'
     and generation_source = 'mise_rules'),
  0,
  'blocked commit clears stale pending mise_rules recommendations'
);

select is(
  (select count(*)::integer from public.insights
   where restaurant_id = '7b000000-0000-4000-8000-000000000001'),
  1,
  'blocked commit still replaces insights'
);

-- Cross-tenant caller must fail authorization before readiness evaluation.
set local role authenticated;
select set_config('request.jwt.claim.sub', '7a333333-3333-4333-8333-333333333333', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  not pg_temp.try_execute($sql$select public.create_pending_purchase_recommendation(
    '7b000000-0000-4000-8000-000000000001', '7b000000-0000-4000-8000-000000000201',
    4, 'Outsider create attempt', 'medium'
  )$sql$),
  'outsider cannot create pending recommendations for another restaurant'
);
select ok(
  not pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    '7b000000-0000-4000-8000-000000000001', '7b000000-0000-4000-8000-000000000601', 9
  )$sql$),
  'outsider cannot approve recommendations for another restaurant'
);
reset role;

select is(
  (select status from private.restaurant_signal_state
   where restaurant_id = '7b000000-0000-4000-8000-000000000001'),
  'current',
  'blocked commit still advances signal status to current'
);

select * from finish();
rollback;
