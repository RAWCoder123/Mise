begin;

select plan(28);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'c4111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mise-003a-correction@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c4000000-0000-4000-8000-000000000001', 'Zero Row Square Kitchen', 'Cafe', 'UTC'),
  ('c4000000-0000-4000-8000-000000000002', 'Manual Only Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c4000000-0000-4000-8000-000000000001', 'c4111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('c4000000-0000-4000-8000-000000000002', 'c4111111-1111-4111-8111-111111111111', 'manager', 'active');

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id in (
  'c4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000002'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name, canonical_unit,
  canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('c4000000-0000-4000-8000-000000000011', 'c4000000-0000-4000-8000-000000000001',
   'Live line A', 'Produce', 'each', 1, 10, 3, 1, 'Live Supplier',
   'each', 1, 'verified', clock_timestamp(), 'c4111111-1111-4111-8111-111111111111'),
  ('c4000000-0000-4000-8000-000000000012', 'c4000000-0000-4000-8000-000000000001',
   'Live line B', 'Produce', 'each', 1, 10, 3, 1, 'Live Supplier',
   'each', 1, 'verified', clock_timestamp(), 'c4111111-1111-4111-8111-111111111111'),
  ('c4000000-0000-4000-8000-000000000013', 'c4000000-0000-4000-8000-000000000001',
   'Live line C', 'Produce', 'each', 1, 10, 3, 1, 'Live Supplier',
   'each', 1, 'verified', clock_timestamp(), 'c4111111-1111-4111-8111-111111111111'),
  ('c4000000-0000-4000-8000-000000000014', 'c4000000-0000-4000-8000-000000000001',
   'Generated zero demand', 'Produce', 'each', 1, 10, 3, 1, 'Generated Supplier',
   'each', 1, 'verified', clock_timestamp(), 'c4111111-1111-4111-8111-111111111111'),
  ('c4000000-0000-4000-8000-000000000015', 'c4000000-0000-4000-8000-000000000002',
   'Manual-only item', 'Produce', 'each', 1, 10, 3, 1, 'Manual Supplier',
   'each', 1, 'verified', clock_timestamp(), 'c4111111-1111-4111-8111-111111111111');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('c4000000-0000-4000-8000-000000000101', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000011', 'count', 1, 'each', clock_timestamp(),
   'c4111111-1111-4111-8111-111111111111', 'correction-test', 'count-a', 'count-a'),
  ('c4000000-0000-4000-8000-000000000102', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000012', 'count', 1, 'each', clock_timestamp(),
   'c4111111-1111-4111-8111-111111111111', 'correction-test', 'count-b', 'count-b'),
  ('c4000000-0000-4000-8000-000000000103', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000013', 'count', 1, 'each', clock_timestamp(),
   'c4111111-1111-4111-8111-111111111111', 'correction-test', 'count-c', 'count-c'),
  ('c4000000-0000-4000-8000-000000000104', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000014', 'count', 1, 'each', clock_timestamp(),
   'c4111111-1111-4111-8111-111111111111', 'correction-test', 'count-generated', 'count-generated'),
  ('c4000000-0000-4000-8000-000000000105', 'c4000000-0000-4000-8000-000000000002',
   'c4000000-0000-4000-8000-000000000015', 'count', 1, 'each', clock_timestamp(),
   'c4111111-1111-4111-8111-111111111111', 'correction-test', 'count-manual', 'count-manual');

insert into public.pos_integrations (
  id, restaurant_id, provider, status, last_sync_at,
  authority_window_from, authority_window_to, authority_window_completed_at
) values (
  'c4000000-0000-4000-8000-000000000201',
  'c4000000-0000-4000-8000-000000000001',
  'square', 'connected', clock_timestamp(),
  current_date - 27, current_date, clock_timestamp()
);
insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
) values (
  'c4000000-0000-4000-8000-000000000202',
  'c4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000201',
  'zero-location', 'Zero Location', 'UTC', 'active'
);

update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = 'c4000000-0000-4000-8000-000000000001';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values
  ('c4000000-0000-4000-8000-000000000401', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000011', 'Live line A', 'Live Supplier',
   2, 'each', 'Manual stock authority A', 'high', 'pending', 'manual', null),
  ('c4000000-0000-4000-8000-000000000402', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000012', 'Live line B', 'Live Supplier',
   2, 'each', 'Manual stock authority B', 'high', 'pending', 'manual', null),
  ('c4000000-0000-4000-8000-000000000403', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000013', 'Live line C', 'Live Supplier',
   2, 'each', 'Manual stock authority C', 'high', 'pending', 'manual', null),
  ('c4000000-0000-4000-8000-000000000404', 'c4000000-0000-4000-8000-000000000001',
   'c4000000-0000-4000-8000-000000000014', 'Generated zero demand', 'Generated Supplier',
   2, 'each', 'Generated demand authority', 'high', 'pending', 'mise_rules',
   (select planning_revision from private.restaurant_signal_state
    where restaurant_id = 'c4000000-0000-4000-8000-000000000001')),
  ('c4000000-0000-4000-8000-000000000405', 'c4000000-0000-4000-8000-000000000002',
   'c4000000-0000-4000-8000-000000000015', 'Manual-only item', 'Manual Supplier',
   2, 'each', 'No provider manual behavior', 'high', 'pending', 'manual', null);

select ok((private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->>'ready')::boolean, 'an exact fresh attestation recognizes a legitimate zero-row Square window as complete');
select is(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->'evidence'->>'demandBasis', 'manual_physical_stock',
  'manual recommendations retain explicit physical-stock semantics');
select ok(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000404', clock_timestamp()
)->'blockers' @> '[{"code":"demand_history_insufficient"}]'::jsonb,
  'MISE-generated recommendations cannot interpret absent demand history as authoritative zero');

update public.pos_integrations
set authority_window_from = null, authority_window_to = null, authority_window_completed_at = null
where id = 'c4000000-0000-4000-8000-000000000201';
select ok(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->'blockers' @> '[{"code":"planning_window_incomplete"}]'::jsonb,
  'configured Square with zero rows and no completed window is unknown and blocked');

update public.pos_integrations
set authority_window_from = current_date - 2,
    authority_window_to = current_date,
    authority_window_completed_at = clock_timestamp() - interval '25 hours',
    last_sync_at = clock_timestamp() - interval '25 hours'
where id = 'c4000000-0000-4000-8000-000000000201';
select ok(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->'blockers' @> '[{"code":"planning_window_incomplete"},{"code":"pos_sync_stale"}]'::jsonb,
  'a stale short zero-row window cannot masquerade as complete');

update public.pos_integrations
set authority_window_from = current_date - 27,
    authority_window_to = current_date,
    authority_window_completed_at = clock_timestamp(),
    last_sync_at = clock_timestamp()
where id = 'c4000000-0000-4000-8000-000000000201';
update public.pos_locations set status = 'paused'
where id = 'c4000000-0000-4000-8000-000000000202';
select ok(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->'blockers' @> '[{"code":"pos_not_connected"}]'::jsonb,
  'configured Square requires at least one active location even when no rows exist');
update public.pos_locations set status = 'active'
where id = 'c4000000-0000-4000-8000-000000000202';

select ok((private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000405', clock_timestamp()
)->>'ready')::boolean, 'no-Square manual-only approval keeps its existing provider-free semantics');

create temporary table correction_sync_token (token uuid) on commit drop;
insert into correction_sync_token (token)
select (private.service_begin_square_authority_sync(
  'c4111111-1111-4111-8111-111111111111',
  'c4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000201',
  'full', current_date - 27, current_date
)->>'syncToken')::uuid;
select ok(private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->'blockers' @> '[{"code":"pos_sync_in_progress"}]'::jsonb,
  'approval blocks throughout the committed provider-fetch synchronization gap');
select is(private.service_apply_square_sync_result_scoped(
  'c4111111-1111-4111-8111-111111111111',
  'c4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000201',
  (select token from correction_sync_token), 'full', '[]'::jsonb, '[]'::jsonb,
  null, current_date - 27, current_date
)->>'snapshotMode', 'full', 'an exact full zero-row snapshot completes through the scoped boundary');
select ok((private.evaluate_purchase_recommendation_authority(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', clock_timestamp()
)->>'ready')::boolean, 'full zero-row completion restores complete authority rather than inferred zero');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4111111-1111-4111-8111-111111111111', true);
select is(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000401', 2
)->>'outcome', 'applied', 'valid line A is approved into its supplier draft');
reset role;

create temporary table draft_before_stale on commit drop as
select order_message, purchase_authority, purchase_authority_evaluated_at
from public.supplier_orders
where restaurant_id = 'c4000000-0000-4000-8000-000000000001'
  and supplier_name = 'Live Supplier';

set session_replication_role = replica;
update public.inventory_events
set effective_at = clock_timestamp() - interval '37 hours'
where id = 'c4000000-0000-4000-8000-000000000101';
set session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4111111-1111-4111-8111-111111111111', true);
select is(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000402', 2
)->>'outcome', 'blocked', 'a stale existing line blocks attachment of ready line B');
select ok(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000402', 2
)->'authority'->'blockers' @> '[{"code":"draft_authority_stale"}]'::jsonb,
  'stale draft revalidation returns the deterministic structured blocker');
reset role;
select is((select status from public.purchase_recommendations
  where id = 'c4000000-0000-4000-8000-000000000402'), 'pending',
  'stale draft denial leaves the new recommendation unchanged');
select is((select count(*)
  from public.supplier_orders draft
  cross join lateral jsonb_object_keys(draft.purchase_authority) authority_key
  where draft.restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and draft.supplier_name = 'Live Supplier'), 1::bigint,
  'stale draft denial leaves the authoritative line map unchanged');
select ok(not (select purchase_authority ? 'c4000000-0000-4000-8000-000000000402'
  from public.supplier_orders
  where restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and supplier_name = 'Live Supplier'),
  'stale draft denial adds no authority material for line B');
select ok((select draft.order_message = before_state.order_message
    and draft.purchase_authority = before_state.purchase_authority
    and draft.purchase_authority_evaluated_at = before_state.purchase_authority_evaluated_at
  from public.supplier_orders draft cross join draft_before_stale before_state
  where draft.restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and draft.supplier_name = 'Live Supplier'),
  'stale draft denial does not rebuild content or replace any authority material');

set session_replication_role = replica;
update public.inventory_events set effective_at = clock_timestamp()
where id = 'c4000000-0000-4000-8000-000000000101';
set session_replication_role = origin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4111111-1111-4111-8111-111111111111', true);
select is(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000402', 2
)->>'outcome', 'applied', 'line B succeeds when every existing line remains currently valid');
reset role;
select is((select count(*)
  from public.supplier_orders draft
  cross join lateral jsonb_object_keys(draft.purchase_authority) authority_key
  where draft.restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and draft.supplier_name = 'Live Supplier'), 2::bigint,
  'successful draft mutation persists the exact two-line authority set');
select is((select count(distinct approval_evaluated_at)
  from public.purchase_recommendations
  where id in (
    'c4000000-0000-4000-8000-000000000401',
    'c4000000-0000-4000-8000-000000000402'
  )), 1::bigint, 'existing and new lines are attested at the same action-time evaluation point');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4111111-1111-4111-8111-111111111111', true);
select is(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000402', 2
)->>'outcome', 'already_applied', 'exact replay remains idempotent after live draft revalidation');
reset role;
select is((select count(*) from public.supplier_orders
  where restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and supplier_name = 'Live Supplier'), 1::bigint,
  'live revalidation and replay create no duplicate supplier order');
select is((select count(*) from public.audit_logs
  where restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and action = 'recommendation_approved'
    and entity_id in (
      'c4000000-0000-4000-8000-000000000401',
      'c4000000-0000-4000-8000-000000000402'
    )), 2::bigint, 'live revalidation and replay create no duplicate applied audit rows');

update public.purchase_recommendations
set generation_source = 'mise_rules', planning_revision = 0
where id = 'c4000000-0000-4000-8000-000000000401';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c4111111-1111-4111-8111-111111111111', true);
select is(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000403', 2
)->>'outcome', 'blocked', 'changed planning authority on line A blocks attachment of line C');
select ok(public.approve_purchase_recommendation(
  'c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000403', 2
)->'authority'->'blockers' @> '[{"code":"draft_authority_stale"}]'::jsonb,
  'planning-stale existing authority is surfaced as draft_authority_stale');
reset role;
select is((select status from public.purchase_recommendations
  where id = 'c4000000-0000-4000-8000-000000000403'), 'pending',
  'planning-stale draft denial leaves line C unchanged');
select ok(not (select purchase_authority ? 'c4000000-0000-4000-8000-000000000403'
  from public.supplier_orders
  where restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and supplier_name = 'Live Supplier'),
  'planning-stale denial leaves draft authority material unchanged');
select is((select count(*)
  from public.supplier_orders draft
  cross join lateral jsonb_object_keys(draft.purchase_authority) authority_key
  where draft.restaurant_id = 'c4000000-0000-4000-8000-000000000001'
    and draft.supplier_name = 'Live Supplier'), 2::bigint,
  'all denial and replay paths leave exactly one authority row per applied line');

select * from finish();
rollback;
