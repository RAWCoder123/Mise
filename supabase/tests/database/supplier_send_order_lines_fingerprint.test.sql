-- Supplier-send fingerprint binds durable supplier_order_lines quantities,
-- not live purchase_recommendations edits after approve.

begin;

select plan(6);

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
  ('6a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'send-lines-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('6a000000-0000-4000-8000-000000000001', 'Send Lines Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('6a000000-0000-4000-8000-000000000001', '6a111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('6a000000-0000-4000-8000-000000000101', '6a000000-0000-4000-8000-000000000001', 'Send Produce', 'send produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('6a000000-0000-4000-8000-000000000201', '6a000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 1, 10, 3, 20,
   '6a000000-0000-4000-8000-000000000101', 'Send Produce',
   'each', 1, 'verified', now(), '6a111111-1111-4111-8111-111111111111');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('6a000000-0000-4000-8000-000000000301', '6a000000-0000-4000-8000-000000000001',
   '6a000000-0000-4000-8000-000000000201', 'count', 1, 'each', now(),
   '6a111111-1111-4111-8111-111111111111', 'send-lines-test', 'send-lines-count-1', 'send-lines-count-1');

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = '6a000000-0000-4000-8000-000000000001';
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = '6a000000-0000-4000-8000-000000000001';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values (
  '6a000000-0000-4000-8000-000000000401', '6a000000-0000-4000-8000-000000000001',
  '6a000000-0000-4000-8000-000000000201', 'Tomatoes',
  '6a000000-0000-4000-8000-000000000101', 'Send Produce',
  12, 'each', 'test', 'medium', 'pending', 'mise_rules', 1
);

insert into public.restaurant_email_connections (
  restaurant_id, provider, status, sender_email, last_verified_at
) values (
  '6a000000-0000-4000-8000-000000000001', 'gmail', 'connected',
  'send-lines@example.com', clock_timestamp()
);

insert into public.supplier_recipients (
  restaurant_id, supplier_id, supplier_name, email
) values (
  '6a000000-0000-4000-8000-000000000001',
  '6a000000-0000-4000-8000-000000000101',
  'Send Produce',
  'produce@send.example'
);

select set_config('request.jwt.claim.sub', '6a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (select public.approve_purchase_recommendation(
    '6a000000-0000-4000-8000-000000000001',
    '6a000000-0000-4000-8000-000000000401',
    null
  ) ->> 'outcome') in ('applied', 'already_applied'),
  'approve creates draft order and durable lines'
);

select is(
  (
    select count(*)::integer
    from public.supplier_order_lines line
    where line.restaurant_id = '6a000000-0000-4000-8000-000000000001'
      and line.purchase_recommendation_id = '6a000000-0000-4000-8000-000000000401'
  ),
  1,
  'approve dual-wrote one durable line'
);

select ok(
  (
    select (private.build_supplier_send_content(
      '6a000000-0000-4000-8000-000000000001',
      (
        select recommendation.supplier_order_id
        from public.purchase_recommendations recommendation
        where recommendation.id = '6a000000-0000-4000-8000-000000000401'
      )
    ) ->> 'ready')::boolean
  ),
  'send content is ready from durable lines'
);

select is(
  (
    select private.build_supplier_send_content(
      '6a000000-0000-4000-8000-000000000001',
      (
        select recommendation.supplier_order_id
        from public.purchase_recommendations recommendation
        where recommendation.id = '6a000000-0000-4000-8000-000000000401'
      )
    ) #>> '{content,lines,0,quantity}'
  ),
  '12',
  'fingerprint quantity comes from durable ordered_quantity'
);

-- Rewrite the durable snapshot while leaving the live recommendation at 12.
-- Send fingerprint must follow the durable line, not recommended_quantity.
update public.supplier_order_lines
set ordered_quantity = 15
where purchase_recommendation_id = '6a000000-0000-4000-8000-000000000401';

update public.supplier_orders
set order_message = 'Order draft for Send Produce' || E'\n\n' ||
  'Tomatoes - 15 each' || E'\n\n' ||
  'Delivery requested: Tomorrow morning'
where id = (
  select recommendation.supplier_order_id
  from public.purchase_recommendations recommendation
  where recommendation.id = '6a000000-0000-4000-8000-000000000401'
);

select is(
  (
    select private.build_supplier_send_content(
      '6a000000-0000-4000-8000-000000000001',
      (
        select recommendation.supplier_order_id
        from public.purchase_recommendations recommendation
        where recommendation.id = '6a000000-0000-4000-8000-000000000401'
      )
    ) #>> '{content,lines,0,quantity}'
  ),
  '15',
  'send fingerprint follows durable ordered_quantity, not live recommended_quantity'
);

-- Missing durable lines fail closed instead of rebuilding from recommendations.
delete from public.supplier_order_lines
where restaurant_id = '6a000000-0000-4000-8000-000000000001';

select is(
  (
    select private.build_supplier_send_content(
      '6a000000-0000-4000-8000-000000000001',
      (
        select recommendation.supplier_order_id
        from public.purchase_recommendations recommendation
        where recommendation.id = '6a000000-0000-4000-8000-000000000401'
      )
    ) -> 'blockerCodes'
  ),
  '["order_lines_missing"]'::jsonb,
  'missing durable lines block send without recommendation rebuild'
);

select * from finish();
rollback;
