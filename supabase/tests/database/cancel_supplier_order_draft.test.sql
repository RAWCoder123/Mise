begin;

select plan(8);

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
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cancel-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cancel-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('c0000000-0000-4000-8000-000000000001', 'Cancel Cafe', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'staff', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values (
  'c0000000-0000-4000-8000-000000000301',
  'c0000000-0000-4000-8000-000000000001',
  'Cancel Produce',
  'cancel produce'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
)
values (
  'c0000000-0000-4000-8000-000000000401',
  'c0000000-0000-4000-8000-000000000001',
  'Basil', 'Produce', 'lb', 2, 10, 4, 3.5,
  'c0000000-0000-4000-8000-000000000301',
  'Cancel Produce'
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
)
values (
  'c0000000-0000-4000-8000-000000000201',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000301',
  'Cancel Produce',
  'Order draft for Cancel Produce',
  'draft',
  current_date + 1
);

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, supplier_order_id
)
values (
  'c0000000-0000-4000-8000-000000000501',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000401',
  'Basil',
  'c0000000-0000-4000-8000-000000000301',
  'Cancel Produce',
  6, 'lb', 'Below reorder', 'medium', 'approved',
  'c0000000-0000-4000-8000-000000000201'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  pg_temp.try_execute($sql$select public.cancel_supplier_order_draft(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201'
  )$sql$) is false,
  'staff cannot cancel a draft supplier order'
);

select is(
  (select status from public.supplier_orders where id = 'c0000000-0000-4000-8000-000000000201'),
  'draft',
  'staff denial leaves the draft intact'
);

select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);

select is(
  (public.cancel_supplier_order_draft(
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000201'
  )->>'outcome'),
  'applied',
  'manager cancel restores the draft'
);

select is(
  (select count(*)::integer from public.supplier_orders
    where id = 'c0000000-0000-4000-8000-000000000201'),
  0,
  'cancelled draft is removed'
);

select is(
  (select status from public.purchase_recommendations
    where id = 'c0000000-0000-4000-8000-000000000501'),
  'pending',
  'approved line returns to pending'
);

select is(
  (select supplier_order_id from public.purchase_recommendations
    where id = 'c0000000-0000-4000-8000-000000000501'),
  null,
  'restored recommendation clears supplier_order_id'
);

select is(
  (select status from public.mise_actions
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:c0000000-0000-4000-8000-000000000201'),
  'cancelled',
  'send action is cancelled'
);

select ok(
  exists (
    select 1 from public.audit_logs
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and action = 'supplier_order_draft_cancelled'
      and entity_id = 'c0000000-0000-4000-8000-000000000201'
  ),
  'cancel writes an audit log'
);

select * from finish();
rollback;
