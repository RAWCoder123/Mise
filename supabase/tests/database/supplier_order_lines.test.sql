-- Durable supplier_order_lines: SELECT for members, no authenticated DML,
-- approve dual-write, undo cascade/rebuild, tenant isolation.

begin;

select plan(13);

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
  ('5a111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lines-manager@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('5a222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lines-staff@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('5b111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lines-other@mise.test', crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('5a000000-0000-4000-8000-000000000001', 'Lines Kitchen', 'Cafe', 'UTC'),
  ('5b000000-0000-4000-8000-000000000001', 'Other Lines Kitchen', 'Cafe', 'UTC');
insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('5a000000-0000-4000-8000-000000000001', '5a111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('5a000000-0000-4000-8000-000000000001', '5a222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('5b000000-0000-4000-8000-000000000001', '5b111111-1111-4111-8111-111111111111', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('5a000000-0000-4000-8000-000000000101', '5a000000-0000-4000-8000-000000000001', 'Lines Produce', 'lines produce'),
  ('5b000000-0000-4000-8000-000000000101', '5b000000-0000-4000-8000-000000000001', 'Other Produce', 'other produce');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  ('5a000000-0000-4000-8000-000000000201', '5a000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 1, 10, 3, 20,
   '5a000000-0000-4000-8000-000000000101', 'Lines Produce',
   'each', 1, 'verified', now(), '5a111111-1111-4111-8111-111111111111'),
  ('5b000000-0000-4000-8000-000000000201', '5b000000-0000-4000-8000-000000000001',
   'Tomatoes', 'Produce', 'each', 1, 10, 3, 20,
   '5b000000-0000-4000-8000-000000000101', 'Other Produce',
   'each', 1, 'verified', now(), '5b111111-1111-4111-8111-111111111111');

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  ('5a000000-0000-4000-8000-000000000301', '5a000000-0000-4000-8000-000000000001',
   '5a000000-0000-4000-8000-000000000201', 'count', 1, 'each', now(),
   '5a111111-1111-4111-8111-111111111111', 'order-lines-test', 'lines-count-1', 'lines-count-1');

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true
where restaurant_id = '5a000000-0000-4000-8000-000000000001';
update private.restaurant_signal_state
set signals_revision = planning_revision, status = 'current'
where restaurant_id = '5a000000-0000-4000-8000-000000000001';

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source, planning_revision
) values (
  '5a000000-0000-4000-8000-000000000401', '5a000000-0000-4000-8000-000000000001',
  '5a000000-0000-4000-8000-000000000201', 'Tomatoes',
  '5a000000-0000-4000-8000-000000000101', 'Lines Produce',
  12, 'each', 'test', 'medium', 'pending', 'mise_rules', 1
);

select has_table('public', 'supplier_order_lines', 'supplier_order_lines exists');
select is(
  has_table_privilege('authenticated', 'public.supplier_order_lines', 'SELECT'),
  true,
  'authenticated can select supplier_order_lines'
);
select is(
  has_table_privilege('authenticated', 'public.supplier_order_lines', 'INSERT')
  or has_table_privilege('authenticated', 'public.supplier_order_lines', 'UPDATE')
  or has_table_privilege('authenticated', 'public.supplier_order_lines', 'DELETE'),
  false,
  'authenticated has no DML on supplier_order_lines'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  (select public.approve_purchase_recommendation(
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000401',
    12
  )->>'outcome') = 'applied',
  'manager approve applies recommendation'
);

select is(
  (
    select count(*)::integer
    from public.supplier_order_lines line
    where line.restaurant_id = '5a000000-0000-4000-8000-000000000001'
      and line.purchase_recommendation_id = '5a000000-0000-4000-8000-000000000401'
  ),
  1,
  'approve dual-writes one durable order line'
);

select is(
  (
    select line.ordered_quantity
    from public.supplier_order_lines line
    where line.purchase_recommendation_id = '5a000000-0000-4000-8000-000000000401'
  ),
  12::numeric,
  'durable line stores approved quantity'
);

select ok(
  (select public.undo_purchase_recommendation_action(
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000401'
  )->>'outcome') = 'applied',
  'manager undo applies'
);

select is(
  (
    select count(*)::integer
    from public.supplier_order_lines line
    where line.restaurant_id = '5a000000-0000-4000-8000-000000000001'
  ),
  0,
  'undo with empty draft removes durable lines'
);

reset role;

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
) values (
  '5b000000-0000-4000-8000-000000000501', '5b000000-0000-4000-8000-000000000001',
  '5b000000-0000-4000-8000-000000000101', 'Other Produce', 'secret', 'draft', current_date + 1
);
insert into public.supplier_order_lines (
  id, restaurant_id, supplier_order_id, inventory_item_id, item_name,
  ordered_quantity, unit, line_position
) values (
  '5b000000-0000-4000-8000-000000000601', '5b000000-0000-4000-8000-000000000001',
  '5b000000-0000-4000-8000-000000000501', '5b000000-0000-4000-8000-000000000201',
  'Tomatoes', 9, 'each', 0
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.supplier_order_lines line
    where line.restaurant_id = '5b000000-0000-4000-8000-000000000001'
  ),
  0,
  'manager cannot read another tenant order lines'
);

select is(
  pg_temp.try_execute($sql$
    insert into public.supplier_order_lines (
      restaurant_id, supplier_order_id, inventory_item_id, item_name,
      ordered_quantity, unit, line_position
    ) values (
      '5a000000-0000-4000-8000-000000000001',
      '5b000000-0000-4000-8000-000000000501',
      '5a000000-0000-4000-8000-000000000201',
      'Tomatoes', 1, 'each', 0
    )
  $sql$),
  false,
  'authenticated cannot insert supplier_order_lines'
);

reset role;

-- Re-approve as manager so a pending recommendation exists for the staff denial check.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  (select public.approve_purchase_recommendation(
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000401',
    12
  )->>'outcome') in ('applied', 'already_applied'),
  'manager can re-approve for staff denial setup'
);
reset role;

-- Undo again to leave pending for staff attempt.
set local role authenticated;
select set_config('request.jwt.claim.sub', '5a111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ok(
  (select public.undo_purchase_recommendation_action(
    '5a000000-0000-4000-8000-000000000001',
    '5a000000-0000-4000-8000-000000000401'
  )->>'outcome') = 'applied',
  'manager undo restores pending recommendation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '5a222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.approve_purchase_recommendation(
      '5a000000-0000-4000-8000-000000000001',
      '5a000000-0000-4000-8000-000000000401',
      12
    )
  $sql$),
  false,
  'staff cannot approve recommendations into order lines'
);

reset role;

select * from finish();
rollback;
