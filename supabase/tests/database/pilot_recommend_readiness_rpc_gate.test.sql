begin;

select plan(12);

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
  ('6a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pilot-ready-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('6a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pilot-blocked-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('6a000000-0000-4000-8000-000000000001', 'Pilot Ready Kitchen', 'Cafe', 'UTC'),
  ('6b000000-0000-4000-8000-000000000001', 'Pilot Blocked Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('6a000000-0000-4000-8000-000000000001', '6a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('6b000000-0000-4000-8000-000000000001', '6a222222-2222-4222-8222-222222222222', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('6a000000-0000-4000-8000-000000000101', '6a000000-0000-4000-8000-000000000001', 'Ready Produce', 'ready produce'),
  ('6b000000-0000-4000-8000-000000000101', '6b000000-0000-4000-8000-000000000001', 'Blocked Produce', 'blocked produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('6a000000-0000-4000-8000-000000000201', '6a000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 4, 10, 3, 1.5,
   '6a000000-0000-4000-8000-000000000101', 'Ready Produce',
   'each', 1, 'verified', now(), '6a111111-1111-4111-8111-111111111111'),
  ('6b000000-0000-4000-8000-000000000201', '6b000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 4, 10, 3, 1.5,
   '6b000000-0000-4000-8000-000000000101', 'Blocked Produce',
   'each', 1, 'verified', now(), '6a222222-2222-4222-8222-222222222222');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('6a000000-0000-4000-8000-000000000301', '6a000000-0000-4000-8000-000000000001',
   '6a000000-0000-4000-8000-000000000201', 'count', 4, 'each', now(),
   '6a111111-1111-4111-8111-111111111111', 'pilot-ready-test', 'ready-count', 'ready-count'),
  ('6b000000-0000-4000-8000-000000000301', '6b000000-0000-4000-8000-000000000001',
   '6b000000-0000-4000-8000-000000000201', 'count', 4, 'each', now(),
   '6a222222-2222-4222-8222-222222222222', 'pilot-blocked-test', 'blocked-count', 'blocked-count');

insert into public.pos_integrations (
  id, restaurant_id, provider, status, last_sync_at
) values (
  '6a000000-0000-4000-8000-000000000401', '6a000000-0000-4000-8000-000000000001',
  'manual_csv', 'connected', now()
);

insert into public.menu_items (id, restaurant_id, name, category, active)
values ('6a000000-0000-4000-8000-000000000501', '6a000000-0000-4000-8000-000000000001',
  'Tomato Salad', 'Entree', true);

insert into public.menu_item_ingredients (
  id, restaurant_id, menu_item_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
) values (
  '6a000000-0000-4000-8000-000000000502', '6a000000-0000-4000-8000-000000000001',
  '6a000000-0000-4000-8000-000000000501', 'Tomato Salad',
  '6a000000-0000-4000-8000-000000000201', 1, 'each'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id
)
select
  '6a000000-0000-4000-8000-000000000001', current_date - service_day,
  'Tomato Salad', 'Entree', 2, 20, 18, 'Manual CSV Upload', 'ready-sale-' || service_day
from generate_series(0, 7) service_day;

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id in (
  '6a000000-0000-4000-8000-000000000001',
  '6b000000-0000-4000-8000-000000000001'
);
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = '6a000000-0000-4000-8000-000000000001';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values
  ('6a000000-0000-4000-8000-000000000601', '6a000000-0000-4000-8000-000000000001',
   '6a000000-0000-4000-8000-000000000201', 'Tomatoes',
   '6a000000-0000-4000-8000-000000000101', 'Ready Produce', 8, 'each',
   'Ready pilot recommendation', 'medium', 'pending', 'mise_rules',
   (select signals_revision from private.restaurant_signal_state
    where restaurant_id = '6a000000-0000-4000-8000-000000000001')),
  ('6b000000-0000-4000-8000-000000000601', '6b000000-0000-4000-8000-000000000001',
   '6b000000-0000-4000-8000-000000000201', 'Tomatoes',
   '6b000000-0000-4000-8000-000000000101', 'Blocked Produce', 8, 'each',
   'Blocked pilot recommendation', 'medium', 'pending', 'manual', null);

select is(has_function_privilege('authenticated', 'private.evaluate_pilot_can_recommend(uuid,timestamptz)', 'EXECUTE'), false,
  'clients cannot invoke the private pilot readiness evaluator');
select is(has_function_privilege('authenticated', 'private.require_pilot_can_recommend(uuid,timestamptz)', 'EXECUTE'), false,
  'clients cannot invoke the private pilot readiness gate');

select ok((private.evaluate_pilot_can_recommend('6a000000-0000-4000-8000-000000000001')->>'canRecommend')::boolean,
  'ready restaurant evaluates canRecommend true');
select ok(not (private.evaluate_pilot_can_recommend('6b000000-0000-4000-8000-000000000001')->>'canRecommend')::boolean,
  'restaurant without POS history evaluates canRecommend false');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6a222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(not pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
  '6b000000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000601', 8
)$sql$), 'approve fails closed without pilot readiness');
select ok(not pg_temp.try_execute($sql$select public.create_pending_purchase_recommendation(
  '6b000000-0000-4000-8000-000000000001', '6b000000-0000-4000-8000-000000000201',
  5, 'Manual add without readiness', 'medium'
)$sql$), 'create_pending fails closed without pilot readiness');
reset role;

select is((select status from public.purchase_recommendations where id = '6b000000-0000-4000-8000-000000000601'),
  'pending', 'blocked approve leaves recommendation pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((public.approve_purchase_recommendation(
  '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000601', 8
)->>'outcome'), 'applied', 'ready restaurant can approve after pilot readiness');
select is((public.approve_purchase_recommendation(
  '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000601', 8
)->>'outcome'), 'already_applied', 'approved replay stays available without re-checking readiness blockers');
reset role;

select is((select status from public.purchase_recommendations where id = '6a000000-0000-4000-8000-000000000601'),
  'approved', 'ready approval persists approved status');

set local role authenticated;
select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.create_pending_purchase_recommendation(
    '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000201',
    3, 'Manual add with readiness', 'low'
  )$sql$,
  'ready restaurant can create a pending recommendation'
);
reset role;

select ok(
  (select count(*) from public.purchase_recommendations
   where restaurant_id = '6a000000-0000-4000-8000-000000000001'
     and inventory_item_id = '6a000000-0000-4000-8000-000000000201'
     and status = 'pending') >= 1,
  'create_pending inserts a pending recommendation when ready'
);

select * from finish();
rollback;
