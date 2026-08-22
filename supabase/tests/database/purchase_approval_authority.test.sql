begin;

select plan(56);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
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
  ('3a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-003a-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('3a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-003a-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone)
values
  ('3a000000-0000-4000-8000-000000000001', 'MISE-003A Kitchen', 'Fast casual', 'UTC'),
  ('3b000000-0000-4000-8000-000000000001', 'Other Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('3a000000-0000-4000-8000-000000000001', '3a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('3b000000-0000-4000-8000-000000000001', '3a222222-2222-4222-8222-222222222222', 'owner', 'active');

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = '3a000000-0000-4000-8000-000000000001';

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('3a000000-0000-4000-8000-000000000011', '3a000000-0000-4000-8000-000000000001',
   'Ready chicken', 'Protein', 'each', 1, 10, 3, 2, 'Pilot Supplier',
   'each', 1, 'verified', now(), '3a111111-1111-4111-8111-111111111111'),
  ('3a000000-0000-4000-8000-000000000012', '3a000000-0000-4000-8000-000000000001',
   'Missing count item', 'Produce', 'each', 1, 10, 3, 1, 'Missing Supplier',
   'each', 1, 'verified', now(), '3a111111-1111-4111-8111-111111111111'),
  ('3a000000-0000-4000-8000-000000000013', '3a000000-0000-4000-8000-000000000001',
   'Stale count item', 'Produce', 'each', 1, 10, 3, 1, 'Stale Supplier',
   'each', 1, 'verified', now(), '3a111111-1111-4111-8111-111111111111'),
  ('3a000000-0000-4000-8000-000000000014', '3a000000-0000-4000-8000-000000000001',
   'Draft unit item', 'Dry goods', 'case', 1, 10, 3, 1, 'Draft Unit Supplier',
   null, null, 'draft', null, null),
  ('3a000000-0000-4000-8000-000000000015', '3a000000-0000-4000-8000-000000000001',
   'Partial demand item', 'Protein', 'each', 1, 10, 3, 2, 'Partial Supplier',
   'each', 1, 'verified', now(), '3a111111-1111-4111-8111-111111111111');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('3a000000-0000-4000-8000-000000000101', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000011', 'count', 1, 'each', clock_timestamp(),
   '3a111111-1111-4111-8111-111111111111', 'mise-003a-test', 'ready-count', 'ready-count'),
  ('3a000000-0000-4000-8000-000000000102', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000013', 'count', 1, 'each', clock_timestamp() - interval '37 hours',
   '3a111111-1111-4111-8111-111111111111', 'mise-003a-test', 'stale-count', 'stale-count'),
  ('3a000000-0000-4000-8000-000000000103', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000015', 'count', 1, 'each', clock_timestamp(),
   '3a111111-1111-4111-8111-111111111111', 'mise-003a-test', 'partial-count', 'partial-count');

insert into public.pos_integrations (
  id, restaurant_id, provider, status, last_sync_at,
  authority_window_from, authority_window_to, authority_window_completed_at
) values (
  '3a000000-0000-4000-8000-000000000201', '3a000000-0000-4000-8000-000000000001',
  'square', 'connected', clock_timestamp(), current_date - 27, current_date, clock_timestamp()
);

insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
) values (
  '3a000000-0000-4000-8000-000000000202', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000201', 'pilot-location', 'Pilot Location', 'UTC', 'active'
);

insert into public.menu_items (id, restaurant_id, name, category, active)
values ('3a000000-0000-4000-8000-000000000301', '3a000000-0000-4000-8000-000000000001',
  'Chicken Sandwich', 'Entree', true);

insert into public.menu_item_ingredients (
  id, restaurant_id, menu_item_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
) values (
  '3a000000-0000-4000-8000-000000000302', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000301', 'Chicken Sandwich',
  '3a000000-0000-4000-8000-000000000011', 1, 'each'
);

update public.menu_items
set recipe_confirmed_revision = recipe_revision,
    recipe_confirmed_at = clock_timestamp(),
    recipe_confirmed_by = '3a111111-1111-4111-8111-111111111111'
where id = '3a000000-0000-4000-8000-000000000301';

insert into public.pos_catalog_item_mappings (
  id, restaurant_id, pos_location_id, external_catalog_item_id, external_variation_id,
  external_name, menu_item_id, verification_status, confidence, effective_from
) values (
  '3a000000-0000-4000-8000-000000000303', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000202', 'sandwich-item', 'sandwich-variation',
  'Chicken Sandwich', '3a000000-0000-4000-8000-000000000301', 'verified', 1,
  clock_timestamp() - interval '40 days'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id, provider_location_id, provider_catalog_item_id, provider_variation_id
)
select
  '3a000000-0000-4000-8000-000000000001', current_date - service_day,
  'Chicken Sandwich', 'Entree', 2, 20, 18, 'Square', 'sale-' || service_day,
  'pilot-location', 'sandwich-item', 'sandwich-variation'
from generate_series(0, 7) service_day;

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source
) values
  ('3a000000-0000-4000-8000-000000000401', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000011', 'Ready chicken', 'Pilot Supplier', 4, 'each',
   'Informational recommendation', 'high', 'pending', 'manual'),
  ('3a000000-0000-4000-8000-000000000402', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000012', 'Missing count item', 'Missing Supplier', 4, 'each',
   'Informational recommendation', 'high', 'pending', 'manual'),
  ('3a000000-0000-4000-8000-000000000403', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000013', 'Stale count item', 'Stale Supplier', 4, 'each',
   'Informational recommendation', 'high', 'pending', 'manual'),
  ('3a000000-0000-4000-8000-000000000404', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000014', 'Draft unit item', 'Draft Unit Supplier', 4, 'case',
   'Informational recommendation', 'high', 'pending', 'manual');

select is(has_function_privilege('authenticated', 'public.list_purchase_recommendation_authority(uuid)', 'EXECUTE'), true,
  'members can read current purchase blockers');
select is(has_function_privilege('authenticated', 'private.evaluate_purchase_recommendation_authority(uuid,uuid,timestamptz)', 'EXECUTE'), false,
  'clients cannot invoke the private authority evaluator');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok((public.list_recipe_authorities('3a000000-0000-4000-8000-000000000001')->0->>'ready')::boolean,
  'the fixture recipe starts explicitly confirmed');
select ok((public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000401'->>'ready')::boolean,
  'fresh complete same-tenant evidence is ready');
select is((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000401', 6
)->>'outcome'), 'applied', 'ready evidence approves atomically');
reset role;

select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000401'),
  'approved', 'ready recommendation becomes approved');
select is((select count(*) from public.supplier_orders where restaurant_id = '3a000000-0000-4000-8000-000000000001'
  and supplier_name = 'Pilot Supplier'), 1::bigint, 'ready approval creates exactly one supplier draft');
select ok((select quantity_overridden from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000401'),
  'manager quantity override is recorded');
select ok((select (approval_authority->>'ready')::boolean from public.purchase_recommendations
  where id = '3a000000-0000-4000-8000-000000000401'), 'structured authority evidence is persisted');
select is((select count(*) from public.audit_logs where entity_id = '3a000000-0000-4000-8000-000000000401'
  and action = 'recommendation_approved' and (metadata->>'quantity_overridden')::boolean), 1::bigint,
  'quantity override has one applied audit transition');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select is((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000401', 6
)->>'outcome'), 'already_applied', 'exact approval replay is idempotent');
reset role;
select is((select count(*) from public.supplier_orders where restaurant_id = '3a000000-0000-4000-8000-000000000001'
  and supplier_name = 'Pilot Supplier'), 1::bigint, 'approval replay creates no duplicate draft');
select is((select count(*) from public.audit_logs where entity_id = '3a000000-0000-4000-8000-000000000401'
  and action = 'recommendation_approved'), 1::bigint, 'approval replay creates no duplicate applied audit');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000402', 4
)->'authority'->'blockers') @> '[{"code":"inventory_count_missing"}]'::jsonb,
  'missing physical count blocks approval');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000402'),
  'pending', 'missing-count denial leaves recommendation informational');
select is((select count(*) from public.supplier_orders where supplier_name = 'Missing Supplier'), 0::bigint,
  'missing-count denial creates no order');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000403', 4
)->'authority'->'blockers') @> '[{"code":"inventory_count_stale"}]'::jsonb,
  'count older than 36 hours blocks approval');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000403'),
  'pending', 'stale-count denial leaves recommendation pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000404', 4
)->'authority'->'blockers') @> '[{"code":"canonical_unit_unverified"}]'::jsonb,
  'unverified canonical unit blocks approval');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000404'),
  'pending', 'unit denial leaves recommendation pending');

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity,
  unit, reason, urgency, status, generation_source, planning_revision
) values (
  '3a000000-0000-4000-8000-000000000405', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000011', 'Ready chicken', 'Pilot Supplier', 4,
  'each', 'Stale generated recommendation', 'high', 'pending', 'mise_rules', 0
);
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = '3a000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000405', 4
)->'authority'->'blockers') @> '[{"code":"planning_revision_stale"}]'::jsonb,
  'hidden stale generated recommendation cannot be approved by UUID');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000405'),
  'pending', 'stale generated recommendation remains unchanged');

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity,
  unit, reason, urgency, status, generation_source
) values (
  '3a000000-0000-4000-8000-000000000406', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000015', 'Partial demand item', 'Partial Supplier', 4,
  'each', 'Partial provider demand', 'high', 'pending', 'manual'
);
insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id, provider_location_id, provider_catalog_item_id, provider_variation_id
) values (
  '3a000000-0000-4000-8000-000000000001', current_date, 'Unmapped provider item', 'Entree',
  1, 10, 9, 'Square', 'unmapped-sale', 'pilot-location', 'unmapped-item', 'unmapped-variation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000406', 4
)->'authority'->'blockers') @> '[{"code":"provider_mapping_missing"}]'::jsonb,
  'unresolved provider demand blocks the mapped subset from becoming authority');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000406'),
  'pending', 'partial-demand denial leaves recommendation pending');

update public.restaurant_operational_controls
set ordering_policy = 'off', order_drafting_enabled = false
where restaurant_id = '3a000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000406', 4
)->'authority'->'blockers') @> '[{"code":"ordering_disabled"}]'::jsonb,
  'persisted drafting controls block order creation');
reset role;
select is((select status from public.purchase_recommendations where id = '3a000000-0000-4000-8000-000000000406'),
  'pending', 'ordering-policy denial leaves recommendation pending');

update public.menu_item_ingredients
set quantity_used_per_sale = 1.5
where id = '3a000000-0000-4000-8000-000000000302';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(not (public.list_recipe_authorities('3a000000-0000-4000-8000-000000000001')->0->>'ready')::boolean,
  'material recipe edit invalidates prior confirmation');
select ok((public.confirm_recipe_complete(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000301',
  (select recipe_revision from public.menu_items where id = '3a000000-0000-4000-8000-000000000301')
)->>'ready')::boolean, 'manager can explicitly confirm the current recipe revision');
select ok((public.list_recipe_authorities('3a000000-0000-4000-8000-000000000001')->0->>'ready')::boolean,
  'confirmed current recipe revision becomes ready');
reset role;

update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = '3a000000-0000-4000-8000-000000000001';
delete from public.pos_sales
where restaurant_id = '3a000000-0000-4000-8000-000000000001'
  and source_record_id = 'unmapped-sale';

set session_replication_role = replica;
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  projection_applied, authority_projected_quantity
) values (
  '3a000000-0000-4000-8000-000000000104', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000015', 'count', 1, 'each',
  clock_timestamp() + interval '3 minutes', '3a111111-1111-4111-8111-111111111111',
  'mise-003a-corruption-fixture', 'future-count', 'future-count', true, 1
);
set session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"inventory_count_future"}]'::jsonb,
  'future physical evidence beyond the two-minute tolerance blocks approval');
reset role;
set session_replication_role = replica;
delete from public.inventory_events where id = '3a000000-0000-4000-8000-000000000104';
set session_replication_role = origin;

set session_replication_role = replica;
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  projection_applied, authority_projected_quantity
) values (
  '3a000000-0000-4000-8000-000000000105', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000015', 'receipt', 1, 'each',
  (select effective_at - interval '1 minute' from public.inventory_events where id = '3a000000-0000-4000-8000-000000000103'),
  '3a111111-1111-4111-8111-111111111111', 'mise-003a-corruption-fixture',
  'contaminating-receipt', 'contaminating-receipt', true, 2
);
set session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"inventory_projection_untrusted"}]'::jsonb,
  'legacy delayed-event contamination blocks approval');
reset role;
set session_replication_role = replica;
delete from public.inventory_events where id = '3a000000-0000-4000-8000-000000000105';
set session_replication_role = origin;

set session_replication_role = replica;
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  projection_applied, authority_projected_quantity
) values (
  '3a000000-0000-4000-8000-000000000106', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000015', 'count', 1, 'each', clock_timestamp(),
  '3a111111-1111-4111-8111-111111111111', 'mise-003a-legacy-fixture',
  'legacy-incomplete-count', 'legacy-incomplete-count', true, null
);
set session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"inventory_evidence_incomplete"}]'::jsonb,
  'legacy ledger evidence without a complete projection blocks approval');
reset role;
set session_replication_role = replica;
delete from public.inventory_events where id = '3a000000-0000-4000-8000-000000000106';
set session_replication_role = origin;

select ok(private.evaluate_purchase_recommendation_authority(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000406',
  clock_timestamp() + interval '37 hours'
)->'blockers' @> '[{"code":"inventory_count_stale"}]'::jsonb,
  'wall-clock passage alone re-evaluates a once-fresh count as stale');

update public.pos_integrations
set last_sync_at = clock_timestamp() - interval '25 hours',
    authority_window_completed_at = clock_timestamp() - interval '25 hours'
where id = '3a000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"pos_sync_stale"}]'::jsonb,
  'Square sync older than 24 hours blocks provider authority');
reset role;
update public.pos_integrations
set last_sync_at = clock_timestamp(), authority_window_completed_at = clock_timestamp(),
    authority_window_from = current_date - 26
where id = '3a000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"planning_window_incomplete"}]'::jsonb,
  'a persisted Square window shorter than 28 days is not authority');
reset role;
update public.pos_integrations
set authority_window_from = current_date - 27, status = 'paused'
where id = '3a000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"pos_not_connected"}]'::jsonb,
  'disconnected provider state blocks approval');
reset role;
update public.pos_integrations set status = 'connected'
where id = '3a000000-0000-4000-8000-000000000201';

update public.pos_sales set provider_variation_id = null
where restaurant_id = '3a000000-0000-4000-8000-000000000001' and source_record_id = 'sale-0';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"provider_identity_incomplete"}]'::jsonb,
  'provider sales never fall back to display-name identity');
reset role;
update public.pos_sales set provider_variation_id = 'sandwich-variation'
where restaurant_id = '3a000000-0000-4000-8000-000000000001' and source_record_id = 'sale-0';

update public.pos_catalog_item_mappings set verification_status = 'draft'
where id = '3a000000-0000-4000-8000-000000000303';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"provider_mapping_missing"}]'::jsonb,
  'draft provider mapping cannot establish purchase identity');
reset role;
update public.pos_catalog_item_mappings set verification_status = 'verified'
where id = '3a000000-0000-4000-8000-000000000303';

update public.menu_items set active = false
where id = '3a000000-0000-4000-8000-000000000301';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"recipe_missing"}]'::jsonb,
  'inactive mapped menu item cannot establish demand authority');
reset role;
update public.menu_items set active = true, recipe_confirmed_revision = null,
  recipe_confirmed_at = null, recipe_confirmed_by = null
where id = '3a000000-0000-4000-8000-000000000301';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"recipe_incomplete"}]'::jsonb,
  'unconfirmed recipe cannot establish provider demand authority');
reset role;
update public.menu_items set recipe_confirmed_revision = recipe_revision,
  recipe_confirmed_at = clock_timestamp(), recipe_confirmed_by = '3a111111-1111-4111-8111-111111111111'
where id = '3a000000-0000-4000-8000-000000000301';

update public.pos_sales set sale_date = current_date
where restaurant_id = '3a000000-0000-4000-8000-000000000001' and source_record_id like 'sale-%';
select ok(private.evaluate_purchase_recommendation_authority(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000405',
  clock_timestamp()
)->'blockers' @> '[{"code":"demand_history_insufficient"}]'::jsonb,
  'fewer than seven prior service days cannot become authoritative zero demand');
update public.pos_sales set sale_date = current_date - split_part(source_record_id, '-', 2)::integer
where restaurant_id = '3a000000-0000-4000-8000-000000000001' and source_record_id like 'sale-%';

select ok(pg_get_functiondef(
  'private.evaluate_purchase_recommendation_authority(uuid,uuid,timestamptz)'::regprocedure
) like '%supplier_missing%', 'server authority fails closed for malformed legacy supplier identity');
update public.purchase_recommendations set supplier_name = 'Other Supplier'
where id = '3a000000-0000-4000-8000-000000000406';
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"supplier_mismatch"}]'::jsonb,
  'recommendation supplier cannot drift from item supplier identity');
reset role;
update public.purchase_recommendations set supplier_name = 'Partial Supplier'
where id = '3a000000-0000-4000-8000-000000000406';

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id
) values (
  '3a000000-0000-4000-8000-000000000001', current_date, 'Manual note item', 'Manual', 1, 0, 0,
  'CSV Import', 'explicit-manual-sale'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(not (public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"provider_identity_incomplete"}]'::jsonb),
  'explicit manual sales remain separate from provider identity authority');
reset role;

update public.system_operational_controls
set ordering_policy = 'off', order_drafting_enabled = false
where singleton;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000406'->'blockers' @> '[{"code":"ordering_disabled"}]'::jsonb,
  'system drafting control independently blocks order creation');
reset role;
update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where singleton;

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values (
  '3a000000-0000-4000-8000-000000000016', '3a000000-0000-4000-8000-000000000001',
  'Legacy tomato', 'Produce', 'each', 1, 10, 3, 1, 'Legacy Supplier',
  'each', 1, 'verified', clock_timestamp(), '3a111111-1111-4111-8111-111111111111'
);
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values (
  '3a000000-0000-4000-8000-000000000107', '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000016', 'count', 1, 'each', clock_timestamp(),
  '3a111111-1111-4111-8111-111111111111', 'mise-003a-test', 'legacy-draft-count', 'legacy-draft-count'
);
insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
) values (
  '3a000000-0000-4000-8000-000000000501', '3a000000-0000-4000-8000-000000000001',
  'Legacy Supplier', 'Legacy draft unchanged', 'draft', current_date + 1
);
insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity,
  unit, reason, urgency, status, generation_source, supplier_order_id, approval_authority
) values
  ('3a000000-0000-4000-8000-000000000407', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000016', 'Legacy onion', 'Legacy Supplier', 2,
   'each', 'Pre-MISE-003A approved line', 'medium', 'approved', 'manual',
   '3a000000-0000-4000-8000-000000000501', null),
  ('3a000000-0000-4000-8000-000000000408', '3a000000-0000-4000-8000-000000000001',
   '3a000000-0000-4000-8000-000000000016', 'Fresh tomato', 'Legacy Supplier', 3,
   'each', 'Current recommendation', 'high', 'pending', 'manual', null, null);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ->'3a000000-0000-4000-8000-000000000408'->'blockers' @> '[{"code":"draft_authority_incomplete"}]'::jsonb,
  'an unattested approved line blocks reuse of its legacy supplier draft');
select is((public.approve_purchase_recommendation(
  '3a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000408', 3
)->>'outcome'), 'blocked', 'approval fails closed before rebuilding an unattested legacy draft');
reset role;
select is((select status from public.purchase_recommendations
  where id = '3a000000-0000-4000-8000-000000000408'), 'pending',
  'legacy draft denial leaves the current recommendation unchanged');
select is((select order_message from public.supplier_orders
  where id = '3a000000-0000-4000-8000-000000000501'), 'Legacy draft unchanged',
  'legacy draft denial leaves supplier content unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select is(pg_temp.try_execute($sql$select public.list_purchase_recommendation_authority(
  '3b000000-0000-4000-8000-000000000001')$sql$), false,
  'cross-tenant actor cannot read purchase authority');
reset role;

select is((select count(*) from public.audit_logs where action = 'purchase_approval_blocked'
  and metadata::text ~* '(token|credential|password|order_message|provider_payload)'), 0::bigint,
  'blocked audit metadata contains no secret or raw payload fields');
set local role authenticated;
select set_config('request.jwt.claim.sub', '3a111111-1111-4111-8111-111111111111', true);
select ok(public.list_purchase_recommendation_authority('3a000000-0000-4000-8000-000000000001')
  ? '3a000000-0000-4000-8000-000000000406', 'informational blocked recommendation remains visible');
reset role;

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id, provider_location_id, provider_catalog_item_id, provider_variation_id
) values
  ('3a000000-0000-4000-8000-000000000001', current_date, 'Removed Square item', 'Entree',
   1, 10, 9, 'Square', 'snapshot-stale', 'pilot-location', 'stale-item', 'stale-variation'),
  ('3a000000-0000-4000-8000-000000000001', current_date - 28, 'Older Square item', 'Entree',
   1, 10, 9, 'Square', 'snapshot-outside', 'pilot-location', 'old-item', 'old-variation');

select ok((private.service_apply_square_sync_result(
  '3a111111-1111-4111-8111-111111111111',
  '3a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000201',
  '[]'::jsonb, '[]'::jsonb, null, current_date - 27, current_date
)->>'recordsRemoved')::integer > 0,
  'complete Square snapshots report reconciled provider rows');
select is((select count(*) from public.pos_sales
  where restaurant_id = '3a000000-0000-4000-8000-000000000001'
    and source_record_id = 'snapshot-stale'), 0::bigint,
  'a provider row absent from the complete replacement snapshot is removed');
select is((select count(*) from public.pos_sales
  where restaurant_id = '3a000000-0000-4000-8000-000000000001'
    and source_record_id = 'snapshot-outside'), 1::bigint,
  'snapshot reconciliation preserves provider rows outside the declared window');
select is((select count(*) from public.pos_sales
  where restaurant_id = '3a000000-0000-4000-8000-000000000001'
    and source_record_id = 'explicit-manual-sale'), 1::bigint,
  'snapshot reconciliation preserves non-provider sales inside the declared window');

select * from finish();
rollback;
