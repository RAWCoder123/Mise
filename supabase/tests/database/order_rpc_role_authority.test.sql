begin;

select plan(35);

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
    'a1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'order-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'order-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'order-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('a0000000-0000-4000-8000-000000000001', 'Order Authority Kitchen A', 'Fast casual'),
  ('b0000000-0000-4000-8000-000000000001', 'Order Authority Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'owner', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  ('a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'A approve item', 'Produce', 'case', 1, 4, 2, 8, 'Supplier A'),
  ('a0000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000001', 'A dismiss item', 'Produce', 'case', 1, 4, 2, 8, 'Supplier A'),
  ('a0000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000001', 'A undo item', 'Produce', 'case', 1, 4, 2, 8, 'Supplier A'),
  ('a0000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000001', 'A create item', 'Produce', 'case', 1, 4, 2, 8, 'Supplier A'),
  ('b0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'B approve item', 'Beverage', 'case', 1, 4, 2, 8, 'Supplier B'),
  ('b0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'B dismiss item', 'Beverage', 'case', 1, 4, 2, 8, 'Supplier B'),
  ('b0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'B undo item', 'Beverage', 'case', 1, 4, 2, 8, 'Supplier B'),
  ('b0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000001', 'B create item', 'Beverage', 'case', 1, 4, 2, 8, 'Supplier B');

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status
)
values
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000011', 'A approve item', 'Supplier A', 3, 'case', 'Role boundary fixture', 'high', 'pending'),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000012', 'A dismiss item', 'Supplier A', 3, 'case', 'Role boundary fixture', 'medium', 'pending'),
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000013', 'A undo item', 'Supplier A', 3, 'case', 'Role boundary fixture', 'low', 'dismissed'),
  ('b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000011', 'B approve item', 'Supplier B', 3, 'case', 'Cross-tenant fixture', 'high', 'pending'),
  ('b0000000-0000-4000-8000-000000000102', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000012', 'B dismiss item', 'Supplier B', 3, 'case', 'Cross-tenant fixture', 'medium', 'pending'),
  ('b0000000-0000-4000-8000-000000000103', 'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000013', 'B undo item', 'Supplier B', 3, 'case', 'Cross-tenant fixture', 'low', 'dismissed');

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, operator_note, status, delivery_date
)
values
  ('a0000000-0000-4000-8000-000000000201', 'a0000000-0000-4000-8000-000000000001', 'Supplier A', 'Unchanged order A', null, 'draft', current_date + 1),
  ('b0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000001', 'Supplier B', 'Unchanged order B', null, 'draft', current_date + 1);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_claim_supplier_email_send(uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the backend-only provider send claim'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.create_pending_purchase_recommendation(uuid,uuid,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the legacy create-pending recommendation RPC'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_create_pending_purchase_recommendation(uuid,uuid,uuid,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot execute the create-pending recommendation service RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 5
  )$sql$),
  false,
  'authenticated staff cannot execute the legacy approval RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_approve_purchase_recommendation(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 5
  )$sql$),
  false,
  'authenticated staff cannot execute the approval service RPC directly'
);
reset role;

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_approve_purchase_recommendation(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000101', 5
  )$sql$),
  false,
  'staff actor cannot approve a purchase recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_dismiss_purchase_recommendation(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000102'
  )$sql$),
  false,
  'staff actor cannot dismiss a purchase recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_undo_purchase_recommendation_action(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000103'
  )$sql$),
  false,
  'staff actor cannot undo a handled purchase recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_update_supplier_order_draft(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000201',
    'forged staff note', true, current_date + 9, true
  )$sql$),
  false,
  'staff actor cannot update a supplier order draft through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_mark_supplier_order_sent(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000201'
  )$sql$),
  false,
  'staff actor cannot invoke the mark-sent observation service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_create_pending_purchase_recommendation(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000014',
    4, 'Staff forged create', 'high'
  )$sql$),
  false,
  'staff actor cannot create a pending purchase recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_claim_supplier_email_send(
    'a2222222-2222-4222-8222-222222222222',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000201',
    '<mise-order-a@mise.test>'
  )$sql$),
  false,
  'backend provider claim rejects a staff actor'
);
reset role;

select is((select status from public.purchase_recommendations where id = 'a0000000-0000-4000-8000-000000000101'), 'pending', 'staff approval denial leaves its recommendation pending');
select is((select status from public.purchase_recommendations where id = 'a0000000-0000-4000-8000-000000000102'), 'pending', 'staff dismissal denial leaves its recommendation pending');
select is((select status from public.purchase_recommendations where id = 'a0000000-0000-4000-8000-000000000103'), 'dismissed', 'staff undo denial leaves its recommendation dismissed');
select is((select status from public.supplier_orders where id = 'a0000000-0000-4000-8000-000000000201'), 'draft', 'staff mark-sent denial leaves the order draft');
select is((select operator_note from public.supplier_orders where id = 'a0000000-0000-4000-8000-000000000201'), null::text, 'staff draft-update denial leaves the operator note unchanged');
select is((select delivery_date from public.supplier_orders where id = 'a0000000-0000-4000-8000-000000000201'), current_date + 1, 'staff draft-update denial leaves the delivery date unchanged');
select is((select count(*) from private.supplier_email_deliveries where restaurant_id = 'a0000000-0000-4000-8000-000000000001'), 0::bigint, 'staff provider-claim denial creates no delivery state');
select is((select count(*) from public.audit_logs where restaurant_id = 'a0000000-0000-4000-8000-000000000001'), 0::bigint, 'staff denials create no workflow audit events');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_approve_purchase_recommendation(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000101', 5
  )$sql$),
  false,
  'manager cannot approve another restaurant recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_dismiss_purchase_recommendation(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000102'
  )$sql$),
  false,
  'manager cannot dismiss another restaurant recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_undo_purchase_recommendation_action(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000103'
  )$sql$),
  false,
  'manager cannot undo another restaurant recommendation through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_update_supplier_order_draft(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000201',
    'forged cross-tenant note', true, current_date + 9, true
  )$sql$),
  false,
  'manager cannot update another restaurant order draft through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_mark_supplier_order_sent(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000201'
  )$sql$),
  false,
  'manager cannot invoke mark-sent for another restaurant through the service RPC'
);
select is(
  pg_temp.try_execute($sql$select public.service_create_pending_purchase_recommendation(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000014',
    4, 'Cross-tenant forged create', 'high'
  )$sql$),
  false,
  'manager cannot create a pending recommendation for another restaurant through the service RPC'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$select public.service_create_pending_purchase_recommendation(
    'a1111111-1111-4111-8111-111111111111',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000014',
    4, 'Manager create path', 'medium'
  )$sql$,
  'manager can create a pending purchase recommendation through the service RPC'
);
reset role;
select is(
  (
    select count(*)::integer
    from public.purchase_recommendations
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and inventory_item_id = 'a0000000-0000-4000-8000-000000000014'
      and status = 'pending'
  ),
  1,
  'manager create-pending service RPC inserts one pending recommendation'
);

select is((select status from public.purchase_recommendations where id = 'b0000000-0000-4000-8000-000000000101'), 'pending', 'cross-tenant approval denial leaves its recommendation pending');
select is((select status from public.purchase_recommendations where id = 'b0000000-0000-4000-8000-000000000102'), 'pending', 'cross-tenant dismissal denial leaves its recommendation pending');
select is((select status from public.purchase_recommendations where id = 'b0000000-0000-4000-8000-000000000103'), 'dismissed', 'cross-tenant undo denial leaves its recommendation dismissed');
select is((select status from public.supplier_orders where id = 'b0000000-0000-4000-8000-000000000201'), 'draft', 'cross-tenant mark-sent denial leaves the order draft');
select is((select operator_note from public.supplier_orders where id = 'b0000000-0000-4000-8000-000000000201'), null::text, 'cross-tenant draft-update denial leaves the operator note unchanged');
select is((select delivery_date from public.supplier_orders where id = 'b0000000-0000-4000-8000-000000000201'), current_date + 1, 'cross-tenant draft-update denial leaves the delivery date unchanged');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_claim_supplier_email_send(
    'a1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000201',
    'b0000000-0000-4000-8000-000000000201',
    '<mise-order-b@mise.test>'
  )$sql$),
  false,
  'backend provider claim rejects a cross-tenant manager actor'
);
reset role;
select is((select count(*) from private.supplier_email_deliveries where restaurant_id = 'b0000000-0000-4000-8000-000000000001'), 0::bigint, 'cross-tenant provider-claim denial creates no delivery state');
select is((select count(*) from public.audit_logs where restaurant_id = 'b0000000-0000-4000-8000-000000000001'), 0::bigint, 'cross-tenant denials create no workflow audit events');

select * from finish();
rollback;
