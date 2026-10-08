begin;

select plan(55);

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
    'authenticated', 'authenticated', 'operational-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'operational-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'operational-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd4444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('d0000000-0000-4000-8000-000000000001', 'Operational Kitchen A', 'Fast casual'),
  ('d0000000-0000-4000-8000-000000000002', 'Operational Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('d0000000-0000-4000-8000-000000000001', 'd2222222-2222-4222-8222-222222222222', 'manager', 'active'),
  ('d0000000-0000-4000-8000-000000000001', 'd3333333-3333-4333-8333-333333333333', 'staff', 'active'),
  ('d0000000-0000-4000-8000-000000000002', 'd4444444-4444-4444-8444-444444444444', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  ('d0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000001', 'Reliable Produce', 'reliable produce'),
  ('d0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000001', 'Fallback Produce', 'fallback produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
)
values
  (
    'd0000000-0000-4000-8000-000000000011',
    'd0000000-0000-4000-8000-000000000001',
    'Roma tomatoes', 'Produce', 'lb', 1, 10, 3, 2.5,
    'd0000000-0000-4000-8000-000000000010', 'Reliable Produce',
    'g', 453.59237, 'verified', now(), 'd2222222-2222-4222-8222-222222222222'
  );

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status
)
values (
  'd0000000-0000-4000-8000-000000000101',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000011',
  'Roma tomatoes', 'd0000000-0000-4000-8000-000000000010',
  'Reliable Produce', 453.59237, 'g',
  'Verified stock is below the service threshold.', 'high', 'pending'
);

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = 'd0000000-0000-4000-8000-000000000001';

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values (
  'd0000000-0000-4000-8000-000000000091',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000011',
  'count', 453.59237, 'g', clock_timestamp(),
  'd2222222-2222-4222-8222-222222222222',
  'mise-003a-test', 'operational-ready-count', 'operational-ready-count'
);

insert into public.pos_integrations (
  id, restaurant_id, provider, status, last_sync_at
) values (
  'd0000000-0000-4000-8000-000000000050',
  'd0000000-0000-4000-8000-000000000001',
  'manual_csv', 'connected', now()
);

insert into public.menu_items (id, restaurant_id, name, category, active)
values (
  'd0000000-0000-4000-8000-000000000060',
  'd0000000-0000-4000-8000-000000000001',
  'Tomato Salad', 'Entree', true
);

insert into public.menu_item_ingredients (
  id, restaurant_id, menu_item_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
) values (
  'd0000000-0000-4000-8000-000000000061',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000060', 'Tomato Salad',
  'd0000000-0000-4000-8000-000000000011', 100, 'g'
);

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales,
  source_pos, source_record_id
)
select
  'd0000000-0000-4000-8000-000000000001', current_date - service_day,
  'Tomato Salad', 'Entree', 2, 20, 18, 'Manual CSV Upload', 'ops-sale-' || service_day
from generate_series(0, 7) service_day;

select is(
  (
    select count(*) from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and event_type = 'approval_required'
      and recommendation_id = 'd0000000-0000-4000-8000-000000000101'
  ),
  1::bigint,
  'a persisted recommendation emits one truthful approval-required activity'
);
select is(
  (
    select count(*) from public.operational_issues
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and dedupe_key = 'inventory-risk:d0000000-0000-4000-8000-000000000011'
      and status = 'action_prepared'
  ),
  1::bigint,
  'a recommendation creates one tenant-scoped operational issue'
);
select is(has_table_privilege('anon', 'public.activity_events', 'INSERT'), false, 'anonymous clients cannot forge activity');
select is(has_table_privilege('authenticated', 'public.activity_events', 'INSERT'), false, 'authenticated clients cannot forge activity');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (public.approve_purchase_recommendation(
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000101',
    453.59237
  )->>'outcome'),
  'applied',
  'a manager can approve a scoped recommendation'
);
reset role;

select ok(
  (select supplier_order_id is not null from public.purchase_recommendations
   where id = 'd0000000-0000-4000-8000-000000000101'),
  'approval creates and links a supplier order draft'
);
select is(
  (
    select action.status from public.mise_actions action
    join public.purchase_recommendations recommendation
      on recommendation.restaurant_id = action.restaurant_id
     and action.idempotency_key = format('send_supplier_order:%s', recommendation.supplier_order_id)
    where recommendation.id = 'd0000000-0000-4000-8000-000000000101'
  ),
  'waiting_for_approval',
  'drafting creates an explicit permissioned send action'
);
select ok(
  (
    select action.expected_impact->>'orderId' = recommendation.supplier_order_id::text
    from public.mise_actions action
    join public.purchase_recommendations recommendation
      on recommendation.restaurant_id = action.restaurant_id
     and action.idempotency_key = format('send_supplier_order:%s', recommendation.supplier_order_id)
    where recommendation.id = 'd0000000-0000-4000-8000-000000000101'
  ),
  'the prepared send action carries its executable supplier-order reference'
);
select is(
  (
    select count(*) from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and event_type = 'order_prepared'
  ),
  1::bigint,
  'drafting emits a prepared-order activity'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  (
    public.decide_mise_action(
      'd0000000-0000-4000-8000-000000000001',
      (
        select action.id from public.mise_actions action
        join public.purchase_recommendations recommendation
          on recommendation.restaurant_id = action.restaurant_id
         and action.idempotency_key = format('send_supplier_order:%s', recommendation.supplier_order_id)
        where recommendation.id = 'd0000000-0000-4000-8000-000000000101'
      ),
      'approved'
    )
  ).status,
  'approved',
  'a manager can approve the prepared external action'
);
reset role;

update public.supplier_orders
set status = 'sent',
  email_provider = 'gmail',
  provider_message_id = 'operational-provider-message-1',
  sent_at = now(),
  sent_by_user_id = 'd2222222-2222-4222-8222-222222222222'
where id = (
  select supplier_order_id from public.purchase_recommendations
  where id = 'd0000000-0000-4000-8000-000000000101'
);

select is(
  (
    select action.status from public.mise_actions action
    join public.purchase_recommendations recommendation
      on recommendation.restaurant_id = action.restaurant_id
     and action.idempotency_key = format('send_supplier_order:%s', recommendation.supplier_order_id)
    where recommendation.id = 'd0000000-0000-4000-8000-000000000101'
  ),
  'executed',
  'provider acceptance advances the action to executed'
);
select is(
  (
    select count(*) from public.activity_events
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and event_type = 'order_sent'
  ),
  1::bigint,
  'provider acceptance emits one order-sent activity'
);

set local role service_role;
select is(
  (public.service_record_supplier_confirmation(
    'd2222222-2222-4222-8222-222222222222',
    'd0000000-0000-4000-8000-000000000001',
    (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
    'acknowledged', 'square-confirmation-1', now() + interval '1 day',
    '{"deliveryWindow":"morning"}'::jsonb, 'square_webhook',
    'supplier-confirmation-1'
  )).confirmation_status,
  'acknowledged',
  'a service workflow can persist a validated supplier confirmation'
);
select ok(
  (public.service_record_supplier_confirmation(
    'd2222222-2222-4222-8222-222222222222',
    'd0000000-0000-4000-8000-000000000001',
    (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
    'acknowledged', 'square-confirmation-1', now() + interval '1 day',
    '{"deliveryWindow":"morning"}'::jsonb, 'square_webhook',
    'supplier-confirmation-1'
  )).id = (
    select id from public.supplier_order_confirmations
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and idempotency_key = 'supplier-confirmation-1'
  ),
  'supplier confirmation replay returns the original durable record'
);
reset role;
select is((select count(*) from public.supplier_order_confirmations where idempotency_key = 'supplier-confirmation-1'), 1::bigint, 'supplier confirmation replay creates no duplicate row');
select is((select count(*) from public.activity_events where event_type = 'supplier_confirmation_received'), 1::bigint, 'a supplier confirmation creates one truthful activity event');
select is(has_function_privilege('authenticated', 'public.service_record_supplier_confirmation(uuid,uuid,uuid,text,text,timestamptz,jsonb,text,text)', 'EXECUTE'), false, 'authenticated clients cannot forge supplier confirmations');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_supplier_delivery(
      'd0000000-0000-4000-8000-000000000001',
      (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
      'operational-delivery-1', now(),
      '[{"inventoryItemId":"d0000000-0000-4000-8000-000000000011","orderedQuantity":453.59237,"receivedQuantity":453.59237,"damagedQuantity":0,"missingQuantity":0,"canonicalUnit":"g","unitPrice":2.5}]'::jsonb,
      2.5, 'Received intact'
    )
  $sql$),
  false,
  'staff cannot verify a supplier delivery'
);

select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_supplier_delivery(
      'd0000000-0000-4000-8000-000000000002',
      'd0000000-0000-4000-8000-000000000999',
      'cross-tenant-delivery', now(),
      '[{"inventoryItemId":"d0000000-0000-4000-8000-000000000011","receivedQuantity":1,"canonicalUnit":"g"}]'::jsonb,
      null, null
    )
  $sql$),
  false,
  'a manager cannot record another tenant delivery'
);
select is(
  (public.record_supplier_delivery(
    'd0000000-0000-4000-8000-000000000001',
    (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
    'operational-delivery-1', now(),
    '[{"inventoryItemId":"d0000000-0000-4000-8000-000000000011","orderedQuantity":453.59237,"receivedQuantity":453.59237,"damagedQuantity":0,"missingQuantity":0,"canonicalUnit":"g","unitPrice":2.5}]'::jsonb,
    2.5, 'Received intact'
  )->>'outcome'),
  'applied',
  'a manager can atomically record a verified delivery'
);
reset role;

select is((select status from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1'), 'received', 'a clean complete delivery is marked received');
select is((select count(*) from public.inventory_events where source_reference in (select id::text from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1')), 1::bigint, 'delivery recording appends one authoritative inventory receipt');
select is((select count(*) from public.supplier_delivery_items where delivery_id in (select id from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1')), 1::bigint, 'delivery line evidence is persisted');
select is((select count(*) from public.action_outcomes where idempotency_key like 'supplier_delivery_outcome:%'), 1::bigint, 'the delivery measures the external action outcome');
select is((select count(*) from public.activity_events where event_type = 'recommendation_outcome_measured'), 1::bigint, 'measured action outcomes are visible in activity history');
select is(
  (
    select count(*) from public.restaurant_memories
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and source = 'supplier_delivery_outcomes'
      and memory_type = 'supplier_reliability'
  ),
  1::bigint,
  'delivery outcomes update a bounded supplier-reliability memory'
);
select is(
  (
    select count(*) from public.activity_events
    where event_type = 'restaurant_memory_updated'
      and trigger_type = 'supplier_delivery_outcome'
  ),
  1::bigint,
  'the learned supplier outcome is visible in activity history'
);
select is((select status from public.supplier_orders where id in (select supplier_order_id from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1')), 'completed', 'a fully received order closes as completed');
select is((select count(*) from public.activity_events where restaurant_id = 'd0000000-0000-4000-8000-000000000001' and event_type = 'delivery_logged'), 1::bigint, 'delivery detail is summarized once instead of flooding activity per receipt line');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  (public.record_supplier_delivery(
    'd0000000-0000-4000-8000-000000000001',
    (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
    'operational-delivery-1', now(),
    '[{"inventoryItemId":"d0000000-0000-4000-8000-000000000011","orderedQuantity":453.59237,"receivedQuantity":453.59237,"canonicalUnit":"g"}]'::jsonb,
    2.5, 'Replay'
  )->>'outcome'),
  'already_applied',
  'the delivery command is idempotent by client delivery id'
);
reset role;
select is((select count(*) from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1'), 1::bigint, 'delivery replay creates no duplicate delivery');
select is((select count(*) from public.inventory_events where source_reference in (select id::text from public.supplier_deliveries where client_delivery_id = 'operational-delivery-1')), 1::bigint, 'delivery replay creates no duplicate inventory receipt');

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
) values (
  'd0000000-0000-4000-8000-000000000202',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000020',
  'Fallback Produce', 'Prepared failure-path order', 'draft', current_date + 1
);

set local role service_role;
select is(
  (public.service_record_mise_action_failure(
    'd2222222-2222-4222-8222-222222222222',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000202',
    'failed', 'provider_not_enabled',
    'Supplier delivery is disabled for this restaurant.'
  )).status,
  'failed',
  'a service workflow records a truthful external-action failure'
);
reset role;
select is(
  (
    select count(*) from public.activity_events
    where event_type = 'automation_failed'
      and related_entity_id = 'd0000000-0000-4000-8000-000000000202'
  ),
  1::bigint,
  'external-action failure creates one owner-visible attention event'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot forge action failures'
);
select is(
  has_function_privilege(
    'service_role',
    'public.service_record_mise_action_failure(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  true,
  'service workflows can record bounded action failures'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  (
    public.decide_mise_action(
      'd0000000-0000-4000-8000-000000000001',
      (
        select id from public.mise_actions
        where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
          and idempotency_key = 'send_supplier_order:d0000000-0000-4000-8000-000000000202'
      ),
      'approved'
    )
  ).status,
  'approved',
  'an explicit manager decision can retry a definitively failed action'
);
reset role;

set local role service_role;
select is(pg_temp.try_execute('update public.action_outcomes set lesson = ''forged'''), false, 'action outcomes remain append-only even for service workflows');
select is(pg_temp.try_execute('delete from public.action_outcomes'), false, 'action outcomes cannot be deleted outside tenant teardown');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3333333-3333-4333-8333-333333333333', true);
select ok((select count(*) from public.activity_events) > 0, 'a restaurant member can read their activity history');
select set_config('request.jwt.claim.sub', 'd4444444-4444-4444-8444-444444444444', true);
select is((select count(*) from public.activity_events), 0::bigint, 'RLS hides another restaurant activity history');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_restaurant_autonomy_rule(
      'd0000000-0000-4000-8000-000000000001', 'create_internal_task',
      'tasks', 4::smallint, false, true, null, null, null, null, null, null
    )
  $sql$),
  false,
  'managers cannot raise restaurant autonomy'
);
select set_config('request.jwt.claim.sub', 'd1111111-1111-4111-8111-111111111111', true);
select is(
  (public.upsert_restaurant_autonomy_rule(
    'd0000000-0000-4000-8000-000000000001', 'create_internal_task',
    'tasks', 4::smallint, false, true, null, null, null, null, null, null
  )).enabled,
  true,
  'an owner can enable a bounded internal automation rule'
);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_restaurant_autonomy_rule(
      'd0000000-0000-4000-8000-000000000001', 'send_supplier_order',
      'orders', 4::smallint, false, true, 10000, 'Reliable Produce', 'email', null, null, null
    )
  $sql$),
  false,
  'unsafe external execution cannot bypass approval through an autonomy rule'
);
reset role;

insert into public.restaurant_memories (
  id, restaurant_id, memory_type, statement, evidence, confidence,
  first_observed_at, last_updated_at, scope, source, affects_recommendations,
  affects_automation, status, dedupe_key
) values (
  'd0000000-0000-4000-8000-000000000301',
  'd0000000-0000-4000-8000-000000000001',
  'supplier_reliability', 'Reliable Produce usually arrives before 9 AM.',
  '[{"type":"supplier_delivery","id":"operational-delivery-1"}]'::jsonb,
  0.72, now() - interval '7 days', now(), 'supplier', 'measured_outcome',
  true, false, 'active', 'supplier-reliability:reliable-produce'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  (public.update_restaurant_memory(
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000301',
    'corrected', 'Reliable Produce normally arrives between 9 and 10 AM.'
  )).status,
  'corrected',
  'restaurant memory is explicitly correctable by a manager'
);
reset role;
select is(
  (
    select count(*) from public.activity_events
    where event_type = 'restaurant_memory_updated'
      and related_entity_id = 'd0000000-0000-4000-8000-000000000301'
  ),
  1::bigint,
  'memory correction is visible in activity history'
);

insert into public.mise_actions (
  id, restaurant_id, action_type, execution_mode, status, autonomy_level,
  reason, evidence, idempotency_key
) values (
  'd0000000-0000-4000-8000-000000000401',
  'd0000000-0000-4000-8000-000000000001',
  'create_internal_task', 'prepare', 'waiting_for_approval', 2,
  'Operational-mode fixture', '[]'::jsonb, 'read-only-fixture'
);

set local role service_role;
select public.service_set_system_operational_mode(
  'd0000000-0000-4000-8000-000000000501', 'read_only',
  'test_read_only', 'd1111111-1111-4111-8111-111111111111'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.decide_mise_action(
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000401', 'approved'
    )
  $sql$),
  false,
  'global read-only mode pauses authenticated operational actions'
);
reset role;

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    select public.service_record_supplier_confirmation(
      'd2222222-2222-4222-8222-222222222222',
      'd0000000-0000-4000-8000-000000000001',
      (select supplier_order_id from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
      'acknowledged', 'paused-confirmation', now() + interval '1 day',
      '{}'::jsonb, 'square_webhook', 'paused-confirmation'
    )
  $sql$),
  false,
  'global read-only mode also pauses service-side confirmation ingestion'
);
reset role;

select is(has_function_privilege('authenticated', 'public.decide_mise_action(uuid,uuid,text)', 'EXECUTE'), true, 'authenticated users can call the guarded action-decision RPC');
select is(has_table_privilege('authenticated', 'public.mise_actions', 'UPDATE'), false, 'authenticated users cannot bypass action RPC authority');
select is(has_function_privilege('authenticated', 'public.service_append_activity_event(uuid,text,text,text,text,timestamptz,text,text,uuid,text,text,jsonb,text[],uuid,uuid,smallint,numeric,text,boolean,timestamptz,text,text,text,uuid,uuid,text,jsonb,text,text,uuid)', 'EXECUTE'), false, 'authenticated users cannot call the service activity writer');
select is(has_function_privilege('service_role', 'public.service_append_activity_event(uuid,text,text,text,text,timestamptz,text,text,uuid,text,text,jsonb,text[],uuid,uuid,smallint,numeric,text,boolean,timestamptz,text,text,text,uuid,uuid,text,jsonb,text,text,uuid)', 'EXECUTE'), true, 'service workflows can append validated activity');
select is(
  (
    select count(*) from information_schema.role_table_grants
    where grantee = 'service_role'
      and table_schema = 'public'
      and table_name in (
        'operational_issues', 'mise_actions', 'action_outcomes',
        'restaurant_memories', 'restaurant_autonomy_rules', 'activity_events',
        'supplier_order_confirmations', 'supplier_deliveries', 'supplier_delivery_items'
      )
      and privilege_type = 'TRUNCATE'
  ),
  0::bigint,
  'service workflows receive no truncate authority on operational records'
);
select is(has_table_privilege('service_role', 'public.activity_events', 'UPDATE'), false, 'service workflows cannot update append-only activity');
select is(has_table_privilege('service_role', 'public.action_outcomes', 'DELETE'), false, 'service workflows cannot delete append-only outcomes');

select * from finish();
rollback;
