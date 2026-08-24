begin;

select plan(54);

create or replace function pg_temp.try_execute(statement text)
returns boolean language plpgsql as $$
begin execute statement; return true;
exception when others then return false;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('4a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'memory-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('4a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'memory-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('4b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'memory-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('4a000000-0000-4000-8000-000000000001', 'Memory Kitchen', 'Cafe', 'UTC'),
  ('4b000000-0000-4000-8000-000000000001', 'Other Memory Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('4a000000-0000-4000-8000-000000000001', '4a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('4a000000-0000-4000-8000-000000000001', '4a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('4b000000-0000-4000-8000-000000000001', '4b111111-1111-4111-8111-111111111111', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('4a000000-0000-4000-8000-000000000101', '4a000000-0000-4000-8000-000000000001', 'Memory Produce', 'memory produce'),
  ('4a000000-0000-4000-8000-000000000102', '4a000000-0000-4000-8000-000000000001', 'Memory Pantry', 'memory pantry'),
  ('4a000000-0000-4000-8000-000000000103', '4a000000-0000-4000-8000-000000000001', 'Memory Dairy', 'memory dairy');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('4a000000-0000-4000-8000-000000000201', '4a000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 1, 10, 3, 20,
   '4a000000-0000-4000-8000-000000000101', 'Memory Produce',
   'each', 1, 'verified', now(), '4a111111-1111-4111-8111-111111111111'),
  ('4a000000-0000-4000-8000-000000000202', '4a000000-0000-4000-8000-000000000001',
   'Rice', 'Pantry', 'g', 1, 10, 3, 10,
   '4a000000-0000-4000-8000-000000000102', 'Memory Pantry',
   'g', 1, 'verified', now(), '4a111111-1111-4111-8111-111111111111'),
  ('4a000000-0000-4000-8000-000000000203', '4a000000-0000-4000-8000-000000000001',
   'Milk', 'Dairy', 'ml', 1, 10, 3, 5,
   '4a000000-0000-4000-8000-000000000103', 'Memory Dairy',
   'ml', 1, 'verified', now(), '4a111111-1111-4111-8111-111111111111');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('4a000000-0000-4000-8000-000000000301', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000201', 'count', 1, 'each', now(),
   '4a111111-1111-4111-8111-111111111111', 'mise-004a-test', 'memory-count-1', 'memory-count-1'),
  ('4a000000-0000-4000-8000-000000000302', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000202', 'count', 1, 'g', now(),
   '4a111111-1111-4111-8111-111111111111', 'mise-004a-test', 'memory-count-2', 'memory-count-2'),
  ('4a000000-0000-4000-8000-000000000303', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000203', 'count', 1, 'ml', now(),
   '4a111111-1111-4111-8111-111111111111', 'mise-004a-test', 'memory-count-3', 'memory-count-3');

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = '4a000000-0000-4000-8000-000000000001';
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = '4a000000-0000-4000-8000-000000000001';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values
  ('4a000000-0000-4000-8000-000000000401', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000201', 'Tomatoes',
   '4a000000-0000-4000-8000-000000000101', 'Memory Produce', 10, 'each',
   'Mise rules evidence', 'medium', 'pending', 'mise_rules',
   (select signals_revision from private.restaurant_signal_state where restaurant_id = '4a000000-0000-4000-8000-000000000001')),
  ('4a000000-0000-4000-8000-000000000402', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000202', 'Rice',
   '4a000000-0000-4000-8000-000000000102', 'Memory Pantry', 6, 'g',
   'Mise rules evidence', 'low', 'pending', 'mise_rules',
   (select signals_revision from private.restaurant_signal_state where restaurant_id = '4a000000-0000-4000-8000-000000000001')),
  ('4a000000-0000-4000-8000-000000000403', '4a000000-0000-4000-8000-000000000001',
   '4a000000-0000-4000-8000-000000000203', 'Milk',
   '4a000000-0000-4000-8000-000000000103', 'Memory Dairy', 4, 'ml',
   'Mise rules evidence', 'high', 'pending', 'mise_rules',
   (select signals_revision from private.restaurant_signal_state where restaurant_id = '4a000000-0000-4000-8000-000000000001'));

select has_table('public', 'purchase_decision_events', 'purchase decision ledger exists');
select is((select count(*) from public.purchase_decision_events), 0::bigint,
  'pending recommendations and migration history create no preference evidence');
select is(has_table_privilege('authenticated', 'public.purchase_decision_events', 'SELECT'), false,
  'authenticated clients cannot read raw actor evidence');
select is(has_table_privilege('authenticated', 'public.purchase_decision_events', 'INSERT'), false,
  'authenticated clients cannot forge raw evidence');
select is(has_table_privilege('service_role', 'public.purchase_decision_events', 'INSERT'), false,
  'service role receives no unnecessary direct event write authority');
select is(has_function_privilege('authenticated', 'private.record_purchase_decision_base_event(public.purchase_recommendations,text,numeric,numeric,jsonb,uuid,timestamptz)', 'EXECUTE'), false,
  'private event writer is not client callable');
select is(has_function_privilege('authenticated', 'public.list_purchase_decision_patterns(uuid)', 'EXECUTE'), true,
  'members can read bounded aggregate patterns');
select is(has_function_privilege('authenticated', 'public.exclude_purchase_decision_event(uuid,uuid)', 'EXECUTE'), true,
  'authorized operators can request deterministic exclusion');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((public.approve_purchase_recommendation(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000401', 8
)->>'outcome'), 'applied', 'Mise approval and decision evidence commit together');
reset role;

select is((select count(*) from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'), 1::bigint,
  'approval writes one event');
select is((select decision_type from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'), 'approve_with_override',
  'quantity change is distinguished from exact approval');
select results_eq(
  $$select recommended_quantity, chosen_quantity from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'$$,
  $$values (10::numeric, 8::numeric)$$,
  'suggested and chosen quantities remain exact');
select results_eq(
  $$select recommended_canonical_quantity, chosen_canonical_quantity, quantity_delta, quantity_ratio from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'$$,
  $$values (10::numeric, 8::numeric, (-2)::numeric, 0.8::numeric)$$,
  'canonical comparison evidence is exact');
select results_eq(
  $$select actor_user_id, actor_role from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'$$,
  $$values ('4a111111-1111-4111-8111-111111111111'::uuid, 'manager'::text)$$,
  'actor identity and action-time role are retained');
select ok((select source_event_key = 'audit_log:' || source_audit_log_id::text
  from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'),
  'event is bound to the exact applied audit transition');
select ok((select context_evidence ? 'planningRevision'
  and not (context_evidence ?| array['operatorNote','orderMessage','email','rawPayload'])
  from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'),
  'context is bounded to an allowlisted factual snapshot');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((public.approve_purchase_recommendation(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000401', 8
)->>'outcome'), 'already_applied', 'exact approval replay remains idempotent');
reset role;
select is((select count(*) from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'), 1::bigint,
  'approval replay creates no duplicate event');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((public.undo_purchase_recommendation_action(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000401'
)->>'outcome'), 'applied', 'undo commits a compensating decision event');
reset role;
select is((select count(*) from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401'), 2::bigint,
  'undo preserves the base event and appends one compensation');
select ok((select target_event_id is not null from public.purchase_decision_events
  where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000401' and decision_type = 'undo'),
  'undo explicitly references the event it compensates');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')
  where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 0::bigint,
  'compensated approval does not remain active in aggregate evidence');
select is((public.dismiss_purchase_recommendation(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000402'
)->>'outcome'), 'applied', 'explicit dismissal writes decision evidence atomically');
reset role;
select results_eq(
  $$select decision_type, chosen_quantity, quantity_ratio from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000402'$$,
  $$values ('dismiss'::text, null::numeric, null::numeric)$$,
  'dismissal never invents a chosen zero quantity');
select set_config(
  'mise.test.dismiss_event_id',
  (select id::text from public.purchase_decision_events
   where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000402'
     and decision_type = 'dismiss'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select decision_type from public.exclude_purchase_decision_event(
  '4a000000-0000-4000-8000-000000000001',
  current_setting('mise.test.dismiss_event_id')::uuid
)), 'exclude_from_learning', 'operator exclusion appends an explicit compensation');
select is((select decision_type from public.exclude_purchase_decision_event(
  '4a000000-0000-4000-8000-000000000001',
  current_setting('mise.test.dismiss_event_id')::uuid
)), 'exclude_from_learning', 'exclusion replay returns the same deterministic event');
reset role;
select is((select count(*) from public.purchase_decision_events
  where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000402' and decision_type = 'exclude_from_learning'), 1::bigint,
  'exclusion replay creates no duplicate');

create function pg_temp.reject_memory_event() returns trigger language plpgsql as $$
begin
  if new.purchase_recommendation_id = '4a000000-0000-4000-8000-000000000403' then
    raise exception 'forced memory write failure';
  end if;
  return new;
end $$;
create trigger force_memory_event_failure before insert on public.purchase_decision_events
for each row execute function pg_temp.reject_memory_event();
update private.restaurant_signal_state set signals_revision = planning_revision, status = 'current'
where restaurant_id = '4a000000-0000-4000-8000-000000000001';
update public.purchase_recommendations set planning_revision = (
  select signals_revision from private.restaurant_signal_state
  where restaurant_id = '4a000000-0000-4000-8000-000000000001'
) where id = '4a000000-0000-4000-8000-000000000403';
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is(pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000403', 4
)$sql$), false, 'event write failure aborts the authority mutation');
reset role;
drop trigger force_memory_event_failure on public.purchase_decision_events;
select is((select status from public.purchase_recommendations where id = '4a000000-0000-4000-8000-000000000403'), 'pending',
  'failed event write rolls recommendation state back');
select is((select count(*) from public.audit_logs where entity_id = '4a000000-0000-4000-8000-000000000403' and action = 'recommendation_approved'), 0::bigint,
  'failed event write rolls applied audit back');
select is((select count(*) from public.purchase_decision_events where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000403'), 0::bigint,
  'failed event write leaves no partial evidence');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((public.approve_purchase_recommendation(
  '4a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000403', 4
)->>'outcome'), 'applied', 'exact approval commits after the forced failure is removed');
reset role;
select results_eq(
  $$select decision_type, recommended_quantity, chosen_quantity, quantity_delta, quantity_ratio
    from public.purchase_decision_events
    where purchase_recommendation_id = '4a000000-0000-4000-8000-000000000403'$$,
  $$values ('approve'::text, 4::numeric, 4::numeric, 0::numeric, 1::numeric)$$,
  'exact approval records exact suggested and chosen snapshots');

-- Aggregate fixtures use trusted direct insertion only to exercise threshold
-- policy independently of the authority workflow above.
insert into public.purchase_decision_events (
  restaurant_id, actor_user_id, actor_role, decision_type,
  purchase_recommendation_id, inventory_item_id, supplier_id,
  recommendation_source, recommendation_unit, recommended_quantity,
  chosen_quantity, canonical_unit, canonical_quantity_per_unit,
  recommended_canonical_quantity, chosen_canonical_quantity,
  quantity_delta, quantity_ratio, planning_revision, context_evidence,
  source_event_key, occurred_at
)
select '4a000000-0000-4000-8000-000000000001',
  case when sample % 2 = 0 then '4a222222-2222-4222-8222-222222222222'::uuid
    else '4a111111-1111-4111-8111-111111111111'::uuid end,
  case when sample % 2 = 0 then 'manager' else 'owner' end,
  'approve_with_override', gen_random_uuid(),
  '4a000000-0000-4000-8000-000000000201', '4a000000-0000-4000-8000-000000000101',
  'mise_rules', 'case', 10, 8, 'each', 12, 120, 96, -2, 0.8, 42,
  jsonb_build_object('planningRevision', 42), 'aggregate-down-' || sample,
  clock_timestamp() - (sample || ' days')::interval
from generate_series(1, 5) sample;

insert into public.purchase_decision_events (
  restaurant_id, actor_user_id, actor_role, decision_type,
  purchase_recommendation_id, inventory_item_id, supplier_id,
  recommendation_source, recommendation_unit, recommended_quantity,
  chosen_quantity, canonical_unit, canonical_quantity_per_unit,
  recommended_canonical_quantity, chosen_canonical_quantity,
  quantity_delta, quantity_ratio, context_evidence, source_event_key, occurred_at
)
select '4a000000-0000-4000-8000-000000000001', '4a111111-1111-4111-8111-111111111111', 'manager',
  case sample when 1 then 'approve' when 2 then 'approve_with_override'
    when 3 then 'approve_with_override' when 4 then 'dismiss' else 'dismiss' end,
  gen_random_uuid(), '4a000000-0000-4000-8000-000000000202', '4a000000-0000-4000-8000-000000000102',
  'mise_rules', 'bag', 6,
  case when sample in (4,5) then null when sample = 2 then 7 when sample = 3 then 5 else 6 end,
  'g', 5000, 30000,
  case when sample in (4,5) then null when sample = 2 then 35000 when sample = 3 then 25000 else 30000 end,
  case when sample in (4,5) then null when sample = 2 then 1 when sample = 3 then -1 else 0 end,
  case when sample in (4,5) then null when sample = 2 then 7::numeric/6 when sample = 3 then 5::numeric/6 else 1 end,
  '{}'::jsonb, 'aggregate-mixed-' || sample, clock_timestamp() - (sample || ' hours')::interval
from generate_series(1, 5) sample;

insert into public.purchase_decision_events (
  restaurant_id, actor_user_id, actor_role, decision_type,
  purchase_recommendation_id, inventory_item_id, supplier_id,
  recommendation_source, recommendation_unit, recommended_quantity,
  chosen_quantity, canonical_unit, canonical_quantity_per_unit,
  recommended_canonical_quantity, chosen_canonical_quantity,
  quantity_delta, quantity_ratio, context_evidence, source_event_key, occurred_at
)
select '4a000000-0000-4000-8000-000000000001', '4a111111-1111-4111-8111-111111111111', 'manager',
  'approve', gen_random_uuid(), '4a000000-0000-4000-8000-000000000203',
  '4a000000-0000-4000-8000-000000000103', 'mise_rules', 'jug', 4, 4,
  'ml', 3785, 15140, 15140, 0, 1, '{}'::jsonb,
  'aggregate-small-' || sample, clock_timestamp() - (sample || ' minutes')::interval
from generate_series(1, 3) sample;

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select sample_count from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 5::bigint,
  'comparable actors collapse into one five-event sample');
select is((select evidence_strength from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 'established',
  'five consistent decisions establish evidence');
select is((select dominant_outcome from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 'downward',
  'consistent downward overrides are factual');
select is((select median_quantity_ratio from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 0.8::numeric,
  'median quantity ratio is deterministic');
select results_eq(
  $$select evidence_strength, dominant_outcome from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000202'$$,
  $$values ('emerging'::text, 'mixed'::text)$$,
  'contradictory decisions never become strong evidence');
select results_eq(
  $$select eligible, evidence_strength from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000203'$$,
  $$values (false, 'insufficient'::text)$$,
  'fewer than five decisions remain insufficient');
reset role;
select results_eq(
  $$select quantity_delta, quantity_ratio from public.purchase_decision_events where source_event_key = 'aggregate-mixed-2'$$,
  $$values (1::numeric, (7::numeric / 6))$$,
  'upward override retains its positive delta and exact ratio');
select is((select count(distinct actor_user_id) from public.purchase_decision_events
  where source_event_key like 'aggregate-down-%'), 2::bigint,
  'distinct actors remain visible in raw evidence while sharing one restaurant pattern');
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select ok((select current_context from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001') where inventory_item_id = '4a000000-0000-4000-8000-000000000201'),
  'pattern is current only while item supplier and canonical unit match');
reset role;

insert into public.purchase_decision_events (
  restaurant_id, actor_user_id, actor_role, decision_type,
  purchase_recommendation_id, inventory_item_id, supplier_id,
  recommendation_source, recommendation_unit, recommended_quantity,
  chosen_quantity, canonical_unit, canonical_quantity_per_unit,
  recommended_canonical_quantity, chosen_canonical_quantity,
  quantity_delta, quantity_ratio, context_evidence, source_event_key, occurred_at
) values (
  '4a000000-0000-4000-8000-000000000001', '4a111111-1111-4111-8111-111111111111',
  'manager', 'approve', gen_random_uuid(), '4a000000-0000-4000-8000-000000000201',
  '4a000000-0000-4000-8000-000000000101', 'mise_rules', 'kg', 10, 10,
  'g', 1000, 10000, 10000, 0, 1, '{}'::jsonb,
  'aggregate-other-unit', clock_timestamp()
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')
  where inventory_item_id = '4a000000-0000-4000-8000-000000000201'), 2::bigint,
  'different canonical units never aggregate together');
reset role;

update public.suppliers set display_name = 'Memory Produce Renamed', normalized_name = 'memory produce renamed'
where id = '4a000000-0000-4000-8000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select sample_count from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')
  where inventory_item_id = '4a000000-0000-4000-8000-000000000201' and canonical_unit = 'each'), 5::bigint,
  'supplier display rename preserves durable pattern identity');
reset role;
update public.inventory_items set item_name = 'Tomatoes Renamed'
where id = '4a000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select sample_count from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')
  where inventory_item_id = '4a000000-0000-4000-8000-000000000201' and canonical_unit = 'each'), 5::bigint,
  'inventory display rename preserves durable pattern identity');
reset role;
update public.inventory_items set supplier_id = '4a000000-0000-4000-8000-000000000102', supplier_name = 'Memory Pantry'
where id = '4a000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', '4a111111-1111-4111-8111-111111111111', true);
select is((select current_context from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')
  where inventory_item_id = '4a000000-0000-4000-8000-000000000201' and canonical_unit = 'each'), false,
  'supplier reassignment makes the old supplier context non-current');
reset role;
select set_config(
  'mise.test.aggregate_event_id',
  (select id::text from public.purchase_decision_events where source_event_key = 'aggregate-down-1'),
  true
);

select is(pg_temp.try_execute($sql$update public.purchase_decision_events set quantity_ratio = 1 where source_event_key = 'aggregate-down-1'$sql$), false,
  'append-only trigger rejects event updates');
select is(pg_temp.try_execute($sql$delete from public.purchase_decision_events where source_event_key = 'aggregate-down-1'$sql$), false,
  'append-only trigger rejects event deletes');

set local role authenticated;
select set_config('request.jwt.claim.sub', '4a222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')), 4::bigint,
  'staff may read factual tenant aggregates');
select is(pg_temp.try_execute($sql$select public.exclude_purchase_decision_event(
  '4a000000-0000-4000-8000-000000000001',
  current_setting('mise.test.aggregate_event_id')::uuid
)$sql$), false, 'staff cannot exclude learning evidence');
select is(pg_temp.try_execute($sql$select * from public.purchase_decision_events limit 1$sql$), false,
  'authenticated clients cannot bypass aggregate privacy with raw SELECT');
select is(pg_temp.try_execute($sql$insert into public.purchase_decision_events (
  restaurant_id, actor_role, decision_type, purchase_recommendation_id,
  inventory_item_id, supplier_id, recommendation_source, recommendation_unit,
  recommended_quantity, chosen_quantity, canonical_unit, canonical_quantity_per_unit,
  recommended_canonical_quantity, chosen_canonical_quantity, quantity_delta,
  quantity_ratio, source_event_key, occurred_at
) values (
  '4a000000-0000-4000-8000-000000000001', 'manager', 'approve', gen_random_uuid(),
  '4a000000-0000-4000-8000-000000000201', '4a000000-0000-4000-8000-000000000101',
  'mise_rules', 'case', 1, 1, 'each', 12, 12, 12, 0, 1, 'forged-event', now()
)$sql$), false, 'authenticated clients cannot forge decision evidence');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '4b111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.list_purchase_decision_patterns('4a000000-0000-4000-8000-000000000001')), 0::bigint,
  'another tenant cannot read purchase patterns');
select is(pg_temp.try_execute($sql$select public.exclude_purchase_decision_event(
  '4a000000-0000-4000-8000-000000000001',
  current_setting('mise.test.aggregate_event_id')::uuid
)$sql$), false, 'another tenant cannot exclude purchase evidence');
reset role;

select * from finish();
rollback;
