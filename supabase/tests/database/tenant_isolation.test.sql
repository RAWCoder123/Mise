begin;

select plan(349);

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

create or replace function pg_temp.mutation_row_count(statement text)
returns bigint
language plpgsql
security invoker
as $$
declare
  affected_rows bigint := 0;
begin
  begin
    execute statement;
    get diagnostics affected_rows = row_count;
    raise exception 'rollback mutation probe' using errcode = 'PZ001';
  exception
    when sqlstate 'PZ001' then
      null;
    when others then
      affected_rows := 0;
  end;
  return affected_rows;
end;
$$;

create or replace function pg_temp.snapshot_inventory_item_id(
  actor_user_id uuid,
  restaurant_id uuid,
  item_name text
)
returns uuid
language sql
security invoker
as $$
  select (payload->>'id')::uuid
  from jsonb_array_elements(
    public.service_fetch_operational_planning_snapshot(actor_user_id, restaurant_id)->'inventoryItems'
  ) payload
  where payload->>'item_name' = item_name
  limit 1;
$$;

create or replace function pg_temp.snapshot_recipe_mapping_id(
  actor_user_id uuid,
  restaurant_id uuid,
  menu_item_name text
)
returns uuid
language sql
security invoker
as $$
  select (payload->>'id')::uuid
  from jsonb_array_elements(
    public.service_fetch_operational_planning_snapshot(actor_user_id, restaurant_id)->'menuItemIngredients'
  ) payload
  where payload->>'menu_item_name' = menu_item_name
  limit 1;
$$;

create or replace function pg_temp.restaurant_operating_date(p_restaurant_id uuid)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select timezone(restaurant.timezone, now())::date
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id;
$$;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-a@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'manager-a@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'staff-a@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-b@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'trainee@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quota-owner@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'quota-backup@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-a@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'dual-tenant@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'abababab-abab-4aba-8aba-abababababab',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'no-membership@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcdcd',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'inactive-a@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner-c@mise.test',
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tenant A Kitchen', 'Fast casual'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tenant B Bistro', 'Cafe'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Tenant C Counter', 'Bakery');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'manager', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'staff', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '88888888-8888-4888-8888-888888888888', 'admin', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '99999999-9999-4999-8999-999999999999', 'manager', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '99999999-9999-4999-8999-999999999999', 'staff', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcdcd', 'staff', 'disabled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'owner', 'active'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'owner', 'active');

insert into public.inventory_items (
  id,
  restaurant_id,
  item_name,
  category,
  unit,
  current_quantity,
  par_level,
  reorder_threshold,
  estimated_unit_cost,
  supplier_name
)
values
  ('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Chicken Breast', 'Protein', 'lb', 20, 30, 10, 4.25, 'Fresh Produce Co.'),
  ('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Espresso Beans', 'Beverage', 'lb', 10, 16, 6, 7.5, 'Cafe Supply'),
  ('cccccccc-1111-4111-8111-cccccccccccc', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Bread Flour', 'Dry goods', 'lb', 25, 40, 12, 1.5, 'Bakery Supply');

insert into public.pos_sales (id, restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos)
values
  ('aaaaaaaa-1010-4010-8010-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 'Chicken Bowl', 'Entree', 2, 20, 18, 'Fixture POS'),
  ('bbbbbbbb-1010-4010-8010-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date, 'Latte', 'Beverage', 2, 12, 11, 'Fixture POS');

insert into public.menu_item_ingredients (id, restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit)
values
  ('aaaaaaaa-1313-4313-8313-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Chicken Bowl', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 0.5, 'lb'),
  ('bbbbbbbb-1313-4313-8313-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Latte', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 0.1, 'lb');

insert into public.insights (id, restaurant_id, insight_type, title, description, recommended_action, severity)
values
  ('aaaaaaaa-1414-4414-8414-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'inventory', 'Tenant A insight', 'Tenant A only.', 'Review inventory.', 'info'),
  ('bbbbbbbb-1414-4414-8414-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'inventory', 'Tenant B insight', 'Tenant B only.', 'Review inventory.', 'info');

insert into public.supplier_items (id, restaurant_id, supplier_name, item_name, unit, estimated_unit_cost)
values
  ('aaaaaaaa-1515-4515-8515-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fresh Produce Co.', 'Chicken Breast', 'lb', 4.25),
  ('bbbbbbbb-1515-4515-8515-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cafe Supply', 'Espresso Beans', 'lb', 7.5);

insert into public.purchase_orders (id, restaurant_id, supplier_name, status, order_payload, subtotal_estimate)
values
  ('aaaaaaaa-1616-4616-8616-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fresh Produce Co.', 'draft', '{"items":[]}'::jsonb, 0),
  ('bbbbbbbb-1616-4616-8616-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cafe Supply', 'draft', '{"items":[]}'::jsonb, 0);

select is(
  pg_temp.try_execute($sql$insert into public.menu_item_ingredients (restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Forged recipe', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 1, 'lb')$sql$),
  false,
  'tenant-safe recipe foreign key rejects a cross-restaurant inventory substitution'
);
select is(
  pg_temp.try_execute($sql$insert into public.purchase_recommendations (restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity, unit, reason, urgency)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'Forged item', 'Forged supplier', 1, 'lb', 'forged', 'low')$sql$),
  false,
  'tenant-safe recommendation foreign key rejects a cross-restaurant inventory substitution'
);

insert into public.purchase_recommendations (
  id,
  restaurant_id,
  inventory_item_id,
  item_name,
  supplier_name,
  recommended_quantity,
  unit,
  reason,
  urgency,
  status
)
values
  ('aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 'Chicken Breast', 'Fresh Produce Co.', 12, 'lb', 'Below par', 'high', 'pending'),
  ('bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb', 'Espresso Beans', 'Cafe Supply', 6, 'lb', 'Below par', 'medium', 'pending');

insert into public.supplier_orders (id, restaurant_id, supplier_name, order_message, status)
values
  ('aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fresh Produce Co.', 'Order chicken', 'draft'),
  ('bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cafe Supply', 'Order beans', 'draft');

insert into public.pos_integrations (id, restaurant_id, provider, status)
values
  ('aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'square', 'connected'),
  ('bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'toast', 'connected');

insert into public.sales_imports (id, restaurant_id, pos_integration_id, import_type, status, records_processed)
values
  ('aaaaaaaa-5555-4555-8555-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-4444-4444-8444-aaaaaaaaaaaa', 'pos_sync', 'completed', 4),
  ('bbbbbbbb-5555-4555-8555-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb', 'pos_sync', 'completed', 5);

select is(
  pg_temp.try_execute($sql$insert into public.sales_imports (restaurant_id, pos_integration_id, import_type, status, records_processed)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-4444-4444-8444-bbbbbbbbbbbb', 'pos_sync', 'completed', 0)$sql$),
  false,
  'tenant-safe sales-import foreign key rejects a cross-restaurant POS integration substitution'
);
select is(
  pg_temp.try_execute($sql$update public.purchase_recommendations
    set supplier_order_id = 'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb'
    where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'$sql$),
  false,
  'tenant-safe recommendation foreign key rejects a cross-restaurant supplier order substitution'
);

insert into public.ai_insights (id, restaurant_id, output, risk_level, confidence, generated_by)
values
  (
    'aaaaaaaa-6666-4666-8666-aaaaaaaaaaaa',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"title":"Prep chicken","summary":"Chicken is trending below par.","recommended_action":"Review the chicken prep plan.","risk_level":"medium","confidence":0.7,"affected_workflow":"inventory","evidence":["Seeded tenant fixture."]}'::jsonb,
    'medium',
    0.7,
    'staging_seed'
  ),
  (
    'bbbbbbbb-6666-4666-8666-bbbbbbbbbbbb',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '{"title":"Prep coffee","summary":"Espresso beans need review.","recommended_action":"Review the espresso bean order.","risk_level":"low","confidence":0.6,"affected_workflow":"inventory","evidence":["Seeded tenant fixture."]}'::jsonb,
    'low',
    0.6,
    'staging_seed'
  );

insert into public.audit_logs (id, restaurant_id, actor_user_id, action, entity_table, entity_id)
values
  ('aaaaaaaa-7777-4777-8777-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'seed', 'inventory_items', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'),
  ('bbbbbbbb-7777-4777-8777-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '44444444-4444-4444-8444-444444444444', 'seed', 'inventory_items', 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb');

insert into public.restaurant_email_connections (id, restaurant_id, provider, status, sender_email)
values
  ('aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'gmail', 'not_connected', null),
  ('bbbbbbbb-8888-4888-8888-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'gmail', 'connected', 'orders@tenant-b.test');

insert into public.supplier_recipients (id, restaurant_id, supplier_name, email)
values
  ('aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Fresh Produce Co.', 'fresh@tenant-a.test'),
  ('bbbbbbbb-9999-4999-8999-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Cafe Supply', 'cafe@tenant-b.test');

insert into public.setup_attachments (id, restaurant_id, kind, label, status, metadata, created_by)
values
  ('aaaaaaaa-aaaa-4aaa-9aaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'screenshot', 'Tenant A inventory screenshot', 'review_needed', '{"storage_status":"metadata_only"}'::jsonb, '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbb01', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'csv', 'Tenant B inventory CSV', 'queued', '{"storage_status":"metadata_only"}'::jsonb, '44444444-4444-4444-8444-444444444444');

create temporary table tenant_insert_probes (
  table_name text primary key,
  statement text not null
) on commit drop;

insert into tenant_insert_probes (table_name, statement)
values
  (
    'pos_sales',
    $probe$insert into public.pos_sales (id, restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos, source_record_id)
      values ('dddddddd-1001-4001-8001-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', current_date, 'Forged pastry', 'Entree', 1, 10, 9, 'Fixture POS', 'cross-tenant-probe')$probe$
  ),
  (
    'inventory_items',
    $probe$insert into public.inventory_items (id, restaurant_id, item_name, category, unit, current_quantity, par_level, reorder_threshold, estimated_unit_cost, supplier_name)
      values ('dddddddd-1002-4002-8002-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Forged inventory', 'Dry goods', 'lb', 1, 2, 1, 1, 'Probe supplier')$probe$
  ),
  (
    'menu_item_ingredients',
    $probe$insert into public.menu_item_ingredients (id, restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit)
      values ('dddddddd-1003-4003-8003-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Forged recipe', 'cccccccc-1111-4111-8111-cccccccccccc', 0.1, 'lb')$probe$
  ),
  (
    'purchase_recommendations',
    $probe$insert into public.purchase_recommendations (id, restaurant_id, inventory_item_id, item_name, supplier_name, recommended_quantity, unit, reason, urgency, status)
      values ('dddddddd-1004-4004-8004-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cccccccc-1111-4111-8111-cccccccccccc', 'Forged recommendation', 'Probe supplier', 1, 'lb', 'Cross-tenant probe', 'low', 'dismissed')$probe$
  ),
  (
    'supplier_orders',
    $probe$insert into public.supplier_orders (id, restaurant_id, supplier_name, order_message, status)
      values ('dddddddd-1005-4005-8005-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Probe supplier', 'Cross-tenant order probe', 'draft')$probe$
  ),
  (
    'insights',
    $probe$insert into public.insights (id, restaurant_id, insight_type, title, description, recommended_action, severity)
      values ('dddddddd-1006-4006-8006-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'inventory', 'Forged insight', 'Cross-tenant probe.', 'Reject this probe.', 'info')$probe$
  ),
  (
    'pos_integrations',
    $probe$insert into public.pos_integrations (id, restaurant_id, provider, status)
      values ('dddddddd-1007-4007-8007-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'square', 'connected')$probe$
  ),
  (
    'sales_imports',
    $probe$insert into public.sales_imports (id, restaurant_id, pos_integration_id, import_type, status, records_processed)
      values ('dddddddd-1008-4008-8008-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', null, 'pos_sync', 'completed', 1)$probe$
  ),
  (
    'supplier_items',
    $probe$insert into public.supplier_items (id, restaurant_id, supplier_name, item_name, unit, estimated_unit_cost)
      values ('dddddddd-1009-4009-8009-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Probe supplier', 'Forged supplier item', 'lb', 1)$probe$
  ),
  (
    'purchase_orders',
    $probe$insert into public.purchase_orders (id, restaurant_id, supplier_name, status, order_payload, subtotal_estimate)
      values ('dddddddd-1010-4010-8010-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Probe supplier', 'draft', '{"items":[]}'::jsonb, 0)$probe$
  ),
  (
    'ai_insights',
    $probe$insert into public.ai_insights (id, restaurant_id, output, risk_level, confidence, generated_by)
      values (
        'dddddddd-1011-4011-8011-dddddddddddd',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '{"title":"Forged insight","summary":"Cross-tenant probe.","recommended_action":"Reject this probe.","risk_level":"low","confidence":0.6,"affected_workflow":"inventory","evidence":["Probe fixture."]}'::jsonb,
        'low',
        0.6,
        'staging_seed'
      )$probe$
  ),
  (
    'audit_logs',
    $probe$insert into public.audit_logs (id, restaurant_id, actor_user_id, action, entity_table, entity_id)
      values ('dddddddd-1012-4012-8012-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cross_tenant_probe', 'inventory_items', 'cccccccc-1111-4111-8111-cccccccccccc')$probe$
  ),
  (
    'restaurant_email_connections',
    $probe$insert into public.restaurant_email_connections (id, restaurant_id, provider, status, sender_email)
      values ('dddddddd-1013-4013-8013-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'gmail', 'not_connected', null)$probe$
  ),
  (
    'supplier_recipients',
    $probe$insert into public.supplier_recipients (id, restaurant_id, supplier_name, email)
      values ('dddddddd-1014-4014-8014-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Probe supplier', 'probe@tenant-c.test')$probe$
  ),
  (
    'setup_attachments',
    $probe$insert into public.setup_attachments (id, restaurant_id, kind, label, status, metadata, created_by)
      values ('dddddddd-1015-4015-8015-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'csv', 'Cross-tenant probe', 'queued', '{"storage_status":"metadata_only"}'::jsonb, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')$probe$
  );

grant select on table tenant_insert_probes to authenticated;

select is(
  pg_temp.mutation_row_count(probe.statement),
  1::bigint,
  format('%s cross-tenant INSERT probe is structurally valid', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

select is(
  pg_temp.mutation_row_count(format(
    'update public.%I set restaurant_id = restaurant_id where restaurant_id = %L',
    probe.table_name,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )),
  1::bigint,
  format('%s cross-tenant UPDATE probe targets a real fixture row', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

select is(
  pg_temp.mutation_row_count(format(
    'delete from public.%I where restaurant_id = %L',
    probe.table_name,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )),
  1::bigint,
  format('%s cross-tenant DELETE probe targets a real fixture row', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.mutation_row_count(probe.statement),
  0::bigint,
  format('manager cannot INSERT into unrelated tenant %s', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

select is(
  pg_temp.mutation_row_count(format(
    'update public.%I set restaurant_id = restaurant_id where restaurant_id = %L',
    probe.table_name,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )),
  0::bigint,
  format('manager cannot UPDATE unrelated tenant %s', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

select is(
  pg_temp.mutation_row_count(format(
    'delete from public.%I where restaurant_id = %L',
    probe.table_name,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  )),
  0::bigint,
  format('manager cannot DELETE unrelated tenant %s', probe.table_name)
)
from tenant_insert_probes probe
order by probe.table_name;

reset role;

select is(has_table_privilege('authenticated', 'public.purchase_recommendations', 'INSERT'), false, 'recommendation inserts are RPC-only');
select is(has_table_privilege('authenticated', 'public.purchase_recommendations', 'UPDATE'), false, 'recommendation transitions are RPC-only');
select is(has_table_privilege('authenticated', 'public.supplier_orders', 'UPDATE'), false, 'supplier-order transitions are RPC-only');
select is(has_table_privilege('authenticated', 'public.audit_logs', 'INSERT'), false, 'semantic audit events are RPC or server-only');
select is(has_table_privilege('authenticated', 'public.supplier_recipients', 'UPDATE'), false, 'setup supplier writes are RPC-only');
select is(has_table_privilege('authenticated', 'public.setup_attachments', 'INSERT'), false, 'setup attachment writes are RPC-only');
select is(has_table_privilege('authenticated', 'public.inventory_items', 'UPDATE'), false, 'inventory count writes are atomic RPC-only');
select is(has_table_privilege('authenticated', 'public.menu_item_ingredients', 'UPDATE'), false, 'recipe baseline writes are atomic RPC-only');
select is(has_table_privilege('authenticated', 'public.restaurant_memberships', 'INSERT'), false, 'membership inserts are RPC-only');
select is(has_table_privilege('authenticated', 'public.restaurant_memberships', 'UPDATE'), false, 'membership updates are RPC-only');
select is(has_table_privilege('authenticated', 'public.restaurant_memberships', 'DELETE'), false, 'membership deletes are RPC-only');
select is(has_table_privilege('authenticated', 'public.users', 'UPDATE'), false, 'legacy user profile updates are RPC-only');
select is(
  (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema in ('public', 'private')),
  0::bigint,
  'anon has no table privileges in the application schemas'
);
select is(
  (
    select array_agg(table_row.tablename::text order by table_row.tablename)
    from pg_tables table_row
    where table_row.schemaname = 'public'
  ),
  array[
    'ai_insights',
    'audit_logs',
    'insights',
    'inventory_items',
    'menu_item_ingredients',
    'outreach_agent_runs',
    'outreach_campaigns',
    'outreach_enrollments',
    'outreach_events',
    'outreach_leads',
    'outreach_messages',
    'outreach_suppressions',
    'pos_integrations',
    'pos_sales',
    'purchase_orders',
    'purchase_recommendations',
    'restaurant_email_connections',
    'restaurant_memberships',
    'restaurants',
    'sales_imports',
    'setup_attachments',
    'supplier_items',
    'supplier_orders',
    'supplier_recipients',
    'users'
  ]::text[],
  'public Data API table inventory is an exact reviewed allowlist'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.table_name in (
        'outreach_agent_runs', 'outreach_campaigns', 'outreach_enrollments', 'outreach_events',
        'outreach_leads', 'outreach_messages', 'outreach_suppressions'
      )
      and grant_row.grantee in ('anon', 'authenticated')
  ),
  0::bigint,
  'service-only outreach tables grant no app-user Data API privileges'
);
select is(
  (
    select count(*)
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'outreach_agent_runs', 'outreach_campaigns', 'outreach_enrollments', 'outreach_events',
        'outreach_leads', 'outreach_messages', 'outreach_suppressions'
      )
  ),
  0::bigint,
  'service-only outreach tables have no app-user RLS policies'
);
with service_only_tables(table_name) as (
  select unnest(array[
    'outreach_agent_runs', 'outreach_campaigns', 'outreach_enrollments', 'outreach_events',
    'outreach_leads', 'outreach_messages', 'outreach_suppressions'
  ]::text[])
), expected_grants(table_name, privilege_type) as (
  select service_only_tables.table_name, privilege_type
  from service_only_tables
  cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]) privilege_type
), actual_grants(table_name, privilege_type) as (
  select grant_row.table_name::text, grant_row.privilege_type::text
  from information_schema.role_table_grants grant_row
  join service_only_tables on service_only_tables.table_name = grant_row.table_name
  where grant_row.table_schema = 'public'
    and grant_row.grantee = 'service_role'
), grant_difference as (
  (select * from expected_grants except select * from actual_grants)
  union all
  (select * from actual_grants except select * from expected_grants)
)
select is(
  (select count(*) from grant_difference),
  0::bigint,
  'service-only outreach tables grant service_role exactly CRUD and nothing broader'
);
select ok(
  not has_function_privilege('anon', 'public.service_claim_outreach_enrollment(uuid,boolean,timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.service_claim_outreach_enrollment(uuid,boolean,timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.service_release_stale_outreach_claims(timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.service_release_stale_outreach_claims(timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.service_unsubscribe_outreach(uuid,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.service_unsubscribe_outreach(uuid,text)', 'execute'),
  'service-only outreach RPCs are not callable by app users'
);
select ok(
  has_function_privilege('service_role', 'public.service_claim_outreach_enrollment(uuid,boolean,timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.service_release_stale_outreach_claims(timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.service_unsubscribe_outreach(uuid,text)', 'execute'),
  'service-only outreach RPCs are callable by service_role'
);
select is(
  (
    select array_agg(table_row.tablename::text order by table_row.tablename)
    from pg_tables table_row
    where table_row.schemaname = 'private'
  ),
  array[
    'edge_function_security_events',
    'environment_identity',
    'restaurant_signal_state',
    'restaurant_workspace_allocations'
  ]::text[],
  'private table inventory is an exact reviewed allowlist'
);
select is(has_table_privilege('authenticated', 'public.inventory_items', 'TRUNCATE'), false, 'authenticated cannot truncate tenant tables');
select is(has_table_privilege('service_role', 'public.inventory_items', 'TRUNCATE'), false, 'service role does not inherit truncate authority');
select is(has_function_privilege('authenticated', 'public.add_restaurant_member(uuid,uuid,text)', 'execute'), true, 'authenticated owners and admins can use the guarded member-add RPC');
select is(has_function_privilege('anon', 'public.add_restaurant_member(uuid,uuid,text)', 'execute'), false, 'anon cannot invoke member administration');
select is(has_function_privilege('authenticated', 'public.update_restaurant_member(uuid,uuid,text,text)', 'execute'), true, 'authenticated owners and admins can use the guarded member-update RPC');
select is(has_function_privilege('authenticated', 'public.remove_restaurant_member(uuid,uuid)', 'execute'), true, 'authenticated owners and admins can use the guarded member-remove RPC');
select is(has_function_privilege('authenticated', 'public.update_my_profile(text)', 'execute'), true, 'authenticated users can use the bounded profile RPC');
select is(has_function_privilege('authenticated', 'public.service_record_edge_audit_log(uuid,uuid,text,text,uuid,jsonb)', 'execute'), false, 'authenticated clients cannot invoke service audit persistence');
select is(has_function_privilege('service_role', 'public.service_record_edge_audit_log(uuid,uuid,text,text,uuid,jsonb)', 'execute'), true, 'service role can invoke actor-bound audit persistence');
select is(has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'), false, 'trigger helpers are not exposed as Data API RPCs');
select is(
  (select count(*) from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'public' and relation.relkind in ('r', 'p') and not relation.relrowsecurity),
  0::bigint,
  'every public application table has RLS enabled'
);
select is(
  (select count(*) from pg_class relation join pg_namespace namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'private' and relation.relkind in ('r', 'p') and not relation.relrowsecurity),
  0::bigint,
  'every private application table has RLS enabled'
);
select is(
  (
    select count(*)
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name in (
        'pos_sales', 'inventory_items', 'menu_item_ingredients', 'purchase_recommendations',
        'supplier_orders', 'insights', 'pos_integrations', 'sales_imports', 'supplier_items',
        'purchase_orders', 'ai_insights', 'audit_logs', 'restaurant_email_connections',
        'supplier_recipients', 'setup_attachments'
      )
      and column_row.column_name = 'restaurant_id'
      and column_row.is_nullable <> 'NO'
  ),
  0::bigint,
  'every tenant resource has a non-null restaurant_id'
);
select is(
  (
    select count(*)
    from unnest(array[
      'pos_sales', 'inventory_items', 'menu_item_ingredients', 'purchase_recommendations',
      'supplier_orders', 'insights', 'pos_integrations', 'sales_imports', 'supplier_items',
      'purchase_orders', 'ai_insights', 'audit_logs', 'restaurant_email_connections',
      'supplier_recipients', 'setup_attachments'
    ]) table_name
    where not exists (
      select 1 from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = table_name
        and policy.cmd = 'SELECT'
        and policy.roles @> array['authenticated']::name[]
        and policy.qual ~ 'private\.(is_restaurant_member|has_restaurant_role)'
    )
  ),
  0::bigint,
  'every tenant table has an authenticated membership-scoped SELECT policy'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type = 'INSERT'
      and grant_row.table_name not in ('restaurant_memberships', 'users')
      and not exists (
        select 1 from pg_policies policy
        where policy.schemaname = 'public' and policy.tablename = grant_row.table_name
          and policy.cmd = 'INSERT' and policy.roles @> array['authenticated']::name[]
          and policy.with_check ~ 'private\.has_restaurant_role'
      )
  ),
  0::bigint,
  'every authenticated direct INSERT grant has a role-scoped WITH CHECK policy'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type = 'UPDATE'
      and not exists (
        select 1 from pg_policies policy
        where policy.schemaname = 'public' and policy.tablename = grant_row.table_name
          and policy.cmd = 'UPDATE' and policy.roles @> array['authenticated']::name[]
          and policy.qual ~ 'private\.has_restaurant_role'
          and policy.with_check ~ 'private\.has_restaurant_role'
      )
  ),
  0::bigint,
  'every authenticated direct UPDATE grant has role-scoped USING and WITH CHECK policies'
);
select is(
  (
    select count(*)
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'public'
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type = 'DELETE'
      and not exists (
        select 1 from pg_policies policy
        where policy.schemaname = 'public' and policy.tablename = grant_row.table_name
          and policy.cmd = 'DELETE' and policy.roles @> array['authenticated']::name[]
          and policy.qual ~ 'private\.has_restaurant_role'
      )
  ),
  0::bigint,
  'every authenticated direct DELETE grant has a role-scoped USING policy'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'restaurant_memberships' and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0::bigint,
  'restaurant membership has no direct authenticated write policies'
);
select is(
  (
    select count(*)
    from pg_class view_row
    join pg_namespace namespace_row on namespace_row.oid = view_row.relnamespace
    where namespace_row.nspname = 'public'
      and view_row.relkind in ('v', 'm')
      and has_table_privilege('authenticated', view_row.oid, 'select')
      and coalesce((view_row.reloptions @> array['security_invoker=true']), false) is not true
  ),
  0::bigint,
  'authenticated views are absent or security_invoker'
);
select is((select count(*) from storage.buckets where public), 0::bigint, 'pilot Storage has no public buckets');
select results_eq(
  $$
    select schemaname || '.' || tablename
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname in ('public', 'private')
  $$,
  array['public.restaurant_memberships'],
  'only restaurant_memberships is published to Realtime; no other tenant table leaks through the socket'
);
select is(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.restaurant_memberships'::regclass
  ),
  true,
  'the Realtime-published membership table keeps row level security enabled'
);
select is(
  (
    select relreplident
    from pg_class
    where oid = 'public.restaurant_memberships'::regclass
  ),
  'f',
  'membership replica identity is full so revocation DELETE events carry the filter columns'
);
select is(
  (
    select count(*)
    from pg_constraint
    where conrelid = 'private.edge_function_security_events'::regclass
      and conname = 'edge_function_security_events_reservation_tenant_fkey'
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (restaurant_id, reservation_id)%'
  ),
  1::bigint,
  'Edge terminal events reference reservations through a tenant-safe composite key'
);
select is(
  (
    select count(*)
    from pg_proc function_row
    join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
    where namespace_row.nspname in ('public', 'private')
      and function_row.prosecdef
      and not coalesce(function_row.proconfig, '{}'::text[]) @> array['search_path=""']
  ),
  0::bigint,
  'every SECURITY DEFINER function pins an empty search path'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.inventory_items), 1::bigint, 'manager reads only their restaurant inventory');
select is((select count(*) from public.purchase_recommendations), 1::bigint, 'manager reads only their restaurant recommendations');
select is((select count(*) from public.supplier_orders), 1::bigint, 'manager reads only their restaurant supplier orders');
select is((select count(*) from public.sales_imports), 1::bigint, 'manager reads only their restaurant POS imports');
select is((select count(*) from public.ai_insights), 1::bigint, 'manager reads only their restaurant AI insights');
select is((select count(*) from public.restaurant_email_connections), 1::bigint, 'manager reads only their restaurant email connection state');
select is((select count(*) from public.supplier_recipients), 1::bigint, 'manager reads only their restaurant supplier recipients');
select is((select count(*) from public.setup_attachments), 1::bigint, 'manager reads only their restaurant setup attachments');
select is((select count(*) from public.supplier_orders where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0::bigint, 'manager cannot directly filter into another restaurant orders');
select is(
  (
    select count(*) from (
      select id from public.pos_sales where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.inventory_items where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.menu_item_ingredients where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.purchase_recommendations where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.supplier_orders where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.insights where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.pos_integrations where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.sales_imports where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.supplier_items where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.purchase_orders where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.ai_insights where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.audit_logs where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.restaurant_email_connections where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.supplier_recipients where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
      union all select id from public.setup_attachments where restaurant_id in ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    ) cross_tenant_rows
  ),
  0::bigint,
  'manager cross-tenant SELECT is empty across every tenant table'
);

select is(
  pg_temp.try_execute($sql$update public.inventory_items set current_quantity = 42 where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'$sql$),
  false,
  'manager cannot update inventory without regenerating operational signals'
);
reset role;
select is((select current_quantity from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 20::numeric, 'direct manager inventory update did not persist');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(
  pg_temp.try_execute($sql$update public.inventory_items set current_quantity = 1 where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'$sql$) is not null,
  'manager cross-tenant inventory update is contained'
);
reset role;
select is((select current_quantity from public.inventory_items where id = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'), 10::numeric, 'manager cannot mutate another restaurant inventory');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute(
    $sql$update public.purchase_recommendations set status = 'approved' where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'$sql$
  ),
  false,
  'manager cannot bypass recommendation workflow with a direct update'
);
reset role;
select is((select status from public.purchase_recommendations where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'), 'pending', 'direct recommendation update did not persist');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    -1
  )$sql$),
  false,
  'approval RPC rejects negative supplier quantities'
);
select is(
  pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    0
  )$sql$),
  false,
  'approval RPC rejects zero supplier quantities'
);
select is(
  pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    'NaN'::numeric
  )$sql$),
  false,
  'approval RPC rejects non-finite supplier quantities'
);
select is(
  pg_temp.try_execute($sql$select public.approve_purchase_recommendation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    1000001
  )$sql$),
  false,
  'approval RPC rejects over-limit supplier quantities'
);
select is(
  (select status from public.purchase_recommendations where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'),
  'pending',
  'invalid approval quantities leave workflow state unchanged'
);
select lives_ok(
  $sql$select public.approve_purchase_recommendation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa',
    12
  )$sql$,
  'manager can approve through the guarded workflow RPC'
);
reset role;
select is((select status from public.purchase_recommendations where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'), 'approved', 'guarded recommendation approval persisted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok(
  $sql$select public.mark_supplier_order_sent(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  )$sql$,
  'manager can send an approved supplier order through the guarded workflow RPC'
);
select is(
  (select status from public.supplier_orders where id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'),
  'sent',
  'guarded supplier-order transition persisted'
);
select is(
  (select status from public.purchase_recommendations where id = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa'),
  'ordered',
  'sending an order transitions its approved recommendation atomically'
);
select is(
  public.mark_supplier_order_sent(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  )->>'outcome',
  'already_applied',
  'replaying a sent transition is explicitly idempotent'
);
select is(
  pg_temp.try_execute($sql$select public.update_supplier_order_draft(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'forged after send',
    true,
    current_date + 2,
    true
  )$sql$),
  false,
  'sent supplier orders cannot be edited through the draft RPC'
);
reset role;
select is(
  (select count(*) from public.audit_logs where action = 'supplier_order_sent' and entity_id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'),
  1::bigint,
  'supplier-order replay creates one semantic audit event'
);
select is(
  (select actor_user_id from public.audit_logs where action = 'supplier_order_sent' and entity_id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'supplier-order audit actor is derived from the authenticated manager'
);

set local role service_role;
select lives_ok(
  $sql$select public.service_update_inventory_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    '{"current_quantity":42}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$,
  'trusted workflow updates manager inventory and both operational signal sets atomically'
);
reset role;
select is((select current_quantity from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 42::numeric, 'atomic inventory update persisted');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_update_inventory_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    '{"current_quantity":43}'::jsonb,
    '[]'::jsonb,
    '[{"insight_type":"invalid","title":"Bad","description":"Bad","recommended_action":"Bad","severity":"warning"}]'::jsonb
  )$sql$),
  false,
  'invalid regenerated signals roll back the inventory count change'
);
reset role;
select is((select current_quantity from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 42::numeric, 'rolled-back signal refresh preserves the prior count');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_update_inventory_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    ((public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint - 1),
    '{"current_quantity":44}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$),
  false,
  'stale inventory editors cannot overwrite a newer count'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(
  pg_temp.try_execute($sql$update public.purchase_recommendations set status = 'approved' where id = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'$sql$) is not null,
  'manager cross-tenant recommendation update is contained'
);
reset role;
select is((select status from public.purchase_recommendations where id = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'), 'pending', 'manager cannot approve another restaurant recommendation');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(
  pg_temp.try_execute($sql$update public.restaurant_email_connections set status = 'connected', sender_email = 'manager@tenant-a.test' where id = 'aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa'$sql$) is not null,
  'manager email connection update is contained'
);
reset role;
select is((select status from public.restaurant_email_connections where id = 'aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa'), 'not_connected', 'manager cannot manage restaurant Gmail sender connection');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$update public.supplier_recipients set email = 'orders@fresh-tenant-a.test' where id = 'aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa'$sql$),
  false,
  'manager cannot bypass setup workflow with a direct supplier recipient update'
);
reset role;
select is((select email from public.supplier_recipients where id = 'aaaaaaaa-9999-4999-8999-aaaaaaaaaaaa'), 'fresh@tenant-a.test', 'direct supplier recipient update did not persist');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select lives_ok(
  $sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '[{"item_name":"Atomic Rice","category":"Setup baseline","unit":"lb","current_quantity":12,"par_level":30,"reorder_threshold":10,"estimated_unit_cost":0,"supplier_name":"Atomic Supply"}]'::jsonb,
    '[{"supplier_name":"Atomic Supply","email":"orders@atomic.test"}]'::jsonb,
    '[{"menu_item_name":"Atomic Bowl","inventory_item_name":"Atomic Rice","quantity_used_per_sale":0.5,"unit":"lb"}]'::jsonb,
    jsonb_build_array(jsonb_build_object('source_record_id', 'atomic-row-1', 'sale_date', pg_temp.restaurant_operating_date('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'item_name', 'Atomic Bowl', 'category', 'Entree', 'quantity_sold', 5, 'gross_sales', 50, 'net_sales', 46.5, 'source_pos', 'Manual CSV Upload')),
    '[]'::jsonb,
    0
  )$sql$,
  'manager can persist a complete setup snapshot through the guarded RPC'
);
select lives_ok(
  $sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '[{"item_name":"Atomic Rice","category":"Setup baseline","unit":"lb","current_quantity":12,"par_level":30,"reorder_threshold":10,"estimated_unit_cost":0,"supplier_name":"Atomic Supply"}]'::jsonb,
    '[{"supplier_name":"Atomic Supply","email":"orders@atomic.test"}]'::jsonb,
    '[{"menu_item_name":"Atomic Bowl","inventory_item_name":"Atomic Rice","quantity_used_per_sale":0.5,"unit":"lb"}]'::jsonb,
    jsonb_build_array(jsonb_build_object('source_record_id', 'atomic-row-1', 'sale_date', pg_temp.restaurant_operating_date('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'item_name', 'Atomic Bowl', 'category', 'Entree', 'quantity_sold', 5, 'gross_sales', 50, 'net_sales', 46.5, 'source_pos', 'Manual CSV Upload')),
    '[]'::jsonb,
    0
  )$sql$,
  'replaying the same setup snapshot succeeds idempotently'
);
reset role;
select is((select count(*) from public.inventory_items where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and item_name = 'Atomic Rice'), 1::bigint, 'setup replay keeps one inventory row');
select is((select count(*) from public.supplier_recipients where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and supplier_name = 'Atomic Supply'), 1::bigint, 'setup replay keeps one supplier recipient');
select is((select count(*) from public.menu_item_ingredients where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and menu_item_name = 'Atomic Bowl'), 1::bigint, 'setup replay keeps one recipe mapping');
select is((select count(*) from public.pos_sales where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and source_record_id = 'atomic-row-1'), 1::bigint, 'setup replay keeps one imported POS sale');
select is((select count(*) from public.audit_logs where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and action = 'setup_saved' and metadata ? 'setup_fingerprint'), 1::bigint, 'setup replay keeps one fingerprinted pending audit event until signals are current');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (select jsonb_agg(jsonb_build_object(
      'item_name', 'Bounded item ' || item_number,
      'category', 'Test',
      'unit', 'lb',
      'current_quantity', 1,
      'par_level', 2,
      'reorder_threshold', 1,
      'estimated_unit_cost', 1,
      'supplier_name', 'Bounded Supplier'
    )) from generate_series(1, 251) as item_number),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    0
  )$sql$),
  false,
  'setup RPC rejects more than 250 inventory rows'
);
select is(
  pg_temp.try_execute($sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '[]'::jsonb,
    '[]'::jsonb,
    (select jsonb_agg(jsonb_build_object(
      'menu_item_name', 'Bounded recipe ' || mapping_number,
      'inventory_item_name', 'Atomic Rice',
      'quantity_used_per_sale', 0.5,
      'unit', 'lb'
    )) from generate_series(1, 1001) as mapping_number),
    '[]'::jsonb,
    '[]'::jsonb,
    0
  )$sql$),
  false,
  'setup RPC rejects more than 1000 recipe mappings'
);
select is(
  pg_temp.try_execute($sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    (select jsonb_agg(jsonb_build_object(
      'source_record_id', 'bounded-sale-' || sale_number,
      'sale_date', current_date,
      'item_name', 'Atomic Bowl',
      'category', 'Entree',
      'quantity_sold', 1,
      'gross_sales', 10,
      'net_sales', 9,
      'source_pos', 'Manual CSV Upload'
    )) from generate_series(1, 1001) as sale_number),
    '[]'::jsonb,
    0
  )$sql$),
  false,
  'setup RPC rejects more than 1000 imported sales rows'
);
select is(
  pg_temp.try_execute($sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '[{"item_name":"Must Roll Back","category":"Test","unit":"lb","current_quantity":-1,"par_level":2,"reorder_threshold":1,"estimated_unit_cost":1,"supplier_name":"Bounded Supplier"}]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    0
  )$sql$),
  false,
  'setup RPC rejects an invalid numeric row atomically'
);
reset role;
select is(
  (select count(*) from public.inventory_items where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and item_name = 'Must Roll Back'),
  0::bigint,
  'invalid setup rows leave no partial inventory writes'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$update public.menu_item_ingredients set quantity_used_per_sale = 9 where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and menu_item_name = 'Atomic Bowl'$sql$),
  false,
  'manager cannot edit a recipe baseline without refreshing operational signals'
);
reset role;
select is((select quantity_used_per_sale from public.menu_item_ingredients where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and menu_item_name = 'Atomic Bowl'), 0.5::numeric, 'direct recipe baseline edit did not persist');

set local role service_role;
select lives_ok(
  $sql$select public.service_save_recipe_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    pg_temp.snapshot_recipe_mapping_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Bowl'
    ),
    'Atomic Bowl',
    pg_temp.snapshot_inventory_item_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Rice'
    ),
    0.6,
    'lb',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$,
  'trusted workflow updates a manager recipe baseline and both signal sets atomically'
);
reset role;
select is((select quantity_used_per_sale from public.menu_item_ingredients where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and menu_item_name = 'Atomic Bowl'), 0.6::numeric, 'atomic recipe baseline update persisted');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_save_recipe_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    pg_temp.snapshot_recipe_mapping_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Bowl'
    ),
    'Atomic Bowl',
    pg_temp.snapshot_inventory_item_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Rice'
    ),
    0.7,
    'lb',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    '[]'::jsonb,
    '[{"insight_type":"invalid","title":"Bad","description":"Bad","recommended_action":"Bad","severity":"warning"}]'::jsonb
  )$sql$),
  false,
  'invalid regenerated signals roll back a recipe baseline update'
);
reset role;
select is((select quantity_used_per_sale from public.menu_item_ingredients where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and menu_item_name = 'Atomic Bowl'), 0.6::numeric, 'rolled-back signal refresh preserves the prior recipe baseline');

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_save_recipe_and_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    pg_temp.snapshot_recipe_mapping_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Bowl'
    ),
    'Atomic Bowl',
    pg_temp.snapshot_inventory_item_id(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Atomic Rice'
    ),
    0.8,
    'lb',
    ((public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint - 1),
    '[]'::jsonb,
    '[]'::jsonb
  )$sql$),
  false,
  'stale recipe baseline editors cannot overwrite a newer mapping'
);
reset role;

insert into public.pos_sales (
  restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos
) values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', pg_temp.restaurant_operating_date('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Atomic Bowl', 'Entree', 2, 20, 18.6, 'Second Test POS'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  (select count(*) from public.fetch_planning_sales('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 28) where item_name = 'Atomic Bowl'),
  1::bigint,
  'bounded planning sales aggregate duplicate menu rows before client processing'
);
select is(
  (select quantity_sold from public.fetch_planning_sales('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 28) where item_name = 'Atomic Bowl'),
  7::numeric,
  'bounded planning sales preserve aggregated quantity'
);
select is(
  (select source_pos from public.fetch_planning_sales('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 28) where item_name = 'Atomic Bowl'),
  'Mise aggregate',
  'bounded planning sales identify multi-source aggregates'
);
select is(
  pg_temp.try_execute($sql$select count(*) from public.fetch_planning_sales('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 28)$sql$),
  false,
  'planning sales RPC rejects cross-tenant reads'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$select public.save_restaurant_setup(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 0
  )$sql$),
  false,
  'staff cannot invoke the manager-owned setup persistence workflow'
);
reset role;

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_commit_operational_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    jsonb_build_array(jsonb_build_object(
      'inventory_item_id', pg_temp.snapshot_inventory_item_id(
        '22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Atomic Rice'
      ),
      'recommended_quantity', 18,
      'reason', 'Atomic setup test',
      'urgency', 'medium'
    )),
    '[{"insight_type":"invalid","title":"Bad","description":"Bad","recommended_action":"Bad","severity":"warning"}]'::jsonb
  )$sql$),
  false,
  'invalid insights roll back the entire combined operational signal refresh'
);
reset role;
select is((select count(*) from public.purchase_recommendations where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and item_name = 'Atomic Rice'), 0::bigint, 'rolled-back signal refresh leaves no partial recommendation');

set local role service_role;
select lives_ok(
  $sql$select public.service_commit_operational_signals(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    (public.service_fetch_operational_planning_snapshot(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    )->>'revision')::bigint,
    jsonb_build_array(jsonb_build_object(
      'inventory_item_id', pg_temp.snapshot_inventory_item_id(
        '22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'Atomic Rice'
      ),
      'recommended_quantity', 18,
      'reason', 'Atomic setup test',
      'urgency', 'medium'
    )),
    '[{"insight_type":"inventory","title":"Atomic Rice is low","description":"Count is below par.","why_it_matters":"Prep may be constrained.","recommended_action":"Review the order.","severity":"warning"}]'::jsonb
  )$sql$,
  'valid recommendations and insights replace together'
);
reset role;
select is((select count(*) from public.purchase_recommendations where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and item_name = 'Atomic Rice' and status = 'pending'), 1::bigint, 'combined signal refresh persists its recommendation');
select is((select count(*) from public.insights where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and title = 'Atomic Rice is low'), 1::bigint, 'combined signal refresh persists its insight');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select ok(
  pg_temp.try_execute($sql$update public.inventory_items set current_quantity = 5 where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'$sql$) is not null,
  'staff inventory update is contained'
);
reset role;
select is((select current_quantity from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 42::numeric, 'staff cannot update inventory counts');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select ok(
  pg_temp.try_execute($sql$delete from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'$sql$) is not null,
  'staff inventory delete is contained'
);
reset role;
select is((select count(*) from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 1::bigint, 'staff cannot delete inventory items');

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select ok(
  pg_temp.try_execute($sql$update public.supplier_orders set status = 'completed' where id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'$sql$) is not null,
  'staff supplier order update is contained'
);
reset role;
select is((select status from public.supplier_orders where id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'), 'sent', 'staff cannot update supplier orders');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(
  pg_temp.try_execute($sql$delete from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'$sql$) is not null,
  'manager inventory delete is contained'
);
reset role;
select is((select count(*) from public.inventory_items where id = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'), 1::bigint, 'manager cannot delete inventory items');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"name":"Tenant A Updated"}'::jsonb
  )$sql$,
  'owner can update restaurant profile through the guarded RPC'
);
reset role;
select is((select name from public.restaurants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Tenant A Updated', 'owner profile update persisted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$update public.restaurant_email_connections set status = 'connected', sender_email = 'orders@tenant-a.test' where id = 'aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa'$sql$,
  'owner can update restaurant Gmail sender connection state'
);
reset role;
select is((select sender_email from public.restaurant_email_connections where id = 'aaaaaaaa-8888-4888-8888-aaaaaaaaaaaa'), 'orders@tenant-a.test', 'owner Gmail sender update persisted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select ok(
  pg_temp.try_execute($sql$update public.restaurants set name = 'Manager Rewrite' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$) is not null,
  'manager restaurant profile update is contained'
);
reset role;
select is((select name from public.restaurants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'Tenant A Updated', 'manager cannot update restaurant profile');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.add_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'staff'
  )$sql$,
  'owner can add a restaurant member through the guarded RPC'
);
reset role;
select is(
  (
    select count(*)
    from public.restaurant_memberships
    where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and user_id = '55555555-5555-4555-8555-555555555555'
  ),
  1::bigint,
  'owner-created membership persisted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'abababab-abab-4aba-8aba-abababababab', 'owner', 'active')$sql$),
  false,
  'owner cannot bypass membership authority with direct DML'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'staff',
    null
  )$sql$),
  false,
  'owner cannot change their own membership through the RPC'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.add_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'abababab-abab-4aba-8aba-abababababab',
    'staff'
  )$sql$),
  false,
  'manager cannot administer memberships'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'manager',
    null
  )$sql$,
  'admin can promote staff to manager'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'owner',
    null
  )$sql$),
  false,
  'admin cannot promote a member to owner'
);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    null,
    'disabled'
  )$sql$,
  'admin can disable a manager'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select is((select count(*) from public.inventory_items), 0::bigint, 'disabled membership loses Data API access with the same JWT subject');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    null,
    'active'
  )$sql$,
  'owner can reactivate a non-owner member'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select lives_ok(
  $sql$select public.remove_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555'
  )$sql$,
  'admin can remove a manager'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.add_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'staff'
  )$sql$,
  'owner can restore a removed staff membership'
);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'owner',
    null
  )$sql$,
  'owner can promote another active member to owner'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'staff',
    null
  )$sql$),
  false,
  'no client can demote an owner'
);
select is(
  pg_temp.try_execute($sql$select public.remove_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555'
  )$sql$),
  false,
  'no client can remove an owner'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_member(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444',
    null,
    'disabled'
  )$sql$),
  false,
  'owner cannot administer an unrelated tenant membership'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
select is(
  pg_temp.try_execute($sql$select public.remove_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222'
  )$sql$),
  false,
  'staff cannot administer memberships'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cdcdcdcd-cdcd-4cdc-8dcd-cdcdcdcdcdcd', true);
select is((select count(*) from public.inventory_items), 0::bigint, 'inactive member cannot read tenant data');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'abababab-abab-4aba-8aba-abababababab', true);
select is((select count(*) from public.restaurants), 0::bigint, 'user without a membership cannot read restaurant data');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select is((select count(*) from public.restaurants), 2::bigint, 'dual-tenant user sees both authorized restaurants');
select is((select count(*) from public.inventory_items), 3::bigint, 'dual-tenant user sees the union of authorized tenant inventory');
select is((select count(*) from public.inventory_items where restaurant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'), 0::bigint, 'dual-tenant user cannot read unrelated tenant C');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-4888-8888-888888888888', true);
select lives_ok(
  $sql$select public.update_restaurant_member(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '99999999-9999-4999-8999-999999999999',
    null,
    'disabled'
  )$sql$,
  'admin can revoke the dual-tenant manager membership'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', true);
select is((select count(*) from public.inventory_items), 1::bigint, 'revocation immediately narrows a dual-tenant JWT to its remaining tenant');
select is((select count(*) from public.inventory_items where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'revoked JWT immediately loses tenant A');
select is((select count(*) from public.inventory_items where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1::bigint, 'revoked JWT retains its independent tenant B membership');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$update public.users set role = 'owner' where id = '11111111-1111-4111-8111-111111111111'$sql$),
  false,
  'client cannot mutate the legacy profile role directly'
);
select lives_ok($sql$select public.update_my_profile('Owner A Display')$sql$, 'bounded profile RPC creates or updates display metadata');
select is((select name from public.users where id = '11111111-1111-4111-8111-111111111111'), 'Owner A Display', 'profile RPC persists the display name');
select is((select role from public.users where id = '11111111-1111-4111-8111-111111111111'), 'staff', 'profile RPC cannot create authorization-bearing role state');
select is(pg_temp.try_execute($sql$select public.update_my_profile('')$sql$), false, 'profile RPC rejects an empty display name');
select is(pg_temp.try_execute($sql$select public.update_my_profile(repeat('N', 121))$sql$), false, 'profile RPC rejects a display name over 120 characters');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.audit_logs), 4::bigint, 'owner reads only their restaurant audit logs, including workflow and setup events');
select is(
  (select count(*) from public.audit_logs where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint,
  'owner cannot filter into another restaurant audit logs'
);
select is(
  pg_temp.try_execute($sql$insert into public.audit_logs (restaurant_id, actor_user_id, action, entity_table)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'checked', 'inventory_items')$sql$),
  false,
  'client cannot insert even a self-attributed semantic audit event directly'
);
select lives_ok(
  $sql$select public.record_setup_completion_audit(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"inventory_items_saved":1,"supplier_recipients_saved":1}'::jsonb
  )$sql$,
  'fixed-semantic setup audit RPC records a server-derived event'
);
select is(
  pg_temp.try_execute($sql$insert into public.audit_logs (restaurant_id, actor_user_id, action, entity_table)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44444444-4444-4444-8444-444444444444', 'forged', 'inventory_items')$sql$),
  false,
  'client audit insert rejects forged actor_user_id'
);
reset role;
select is((select count(*) from public.audit_logs where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 5::bigint, 'only workflow-derived and fixed-semantic audit events persisted');

select is(
  pg_temp.try_execute($sql$insert into public.supplier_items (restaurant_id, supplier_name, item_name, unit, estimated_unit_cost)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '', 'Tomatoes', 'lb', 1)$sql$),
  false,
  'supplier item constraint rejects blank supplier names'
);
select is(
  pg_temp.try_execute($sql$insert into public.pos_integrations (restaurant_id, provider, status, settings)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'clover', 'connected', '{"access_token":"nope"}'::jsonb)$sql$),
  false,
  'POS integration settings reject public token-like keys'
);
select is(
  pg_temp.try_execute($sql$insert into public.sales_imports (restaurant_id, import_type, status, records_processed, metadata)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pos_sync', 'failed', 0, '{"missingSecret":"SQUARE_ACCESS_TOKEN"}'::jsonb)$sql$),
  false,
  'sales import metadata rejects provider secret identifiers'
);
select is(
  pg_temp.try_execute($sql$insert into public.setup_attachments (restaurant_id, kind, label, status, metadata, created_by)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'screenshot', 'Raw screenshot', 'queued', '{"storage_status":"raw_file"}'::jsonb, '11111111-1111-4111-8111-111111111111')$sql$),
  false,
  'setup attachments must remain metadata-only'
);
select is(
  pg_temp.try_execute($sql$insert into public.inventory_items (
    restaurant_id, item_name, category, unit, current_quantity, par_level,
    reorder_threshold, estimated_unit_cost, supplier_name
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Negative inventory', 'Test', 'lb', -1, 2, 1, 1, 'Bounded Supplier'
  )$sql$),
  false,
  'inventory table constraint rejects negative quantities'
);
select is(
  pg_temp.try_execute($sql$insert into public.inventory_items (
    restaurant_id, item_name, category, unit, current_quantity, par_level,
    reorder_threshold, estimated_unit_cost, supplier_name
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Non-finite inventory', 'Test', 'lb', 'NaN'::numeric, 2, 1, 1, 'Bounded Supplier'
  )$sql$),
  false,
  'inventory table constraint rejects non-finite quantities'
);
select is(
  pg_temp.try_execute($sql$insert into public.pos_sales (
    restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 'Extreme sale', 'Test', 100001, 10, 9, 'Constraint probe'
  )$sql$),
  false,
  'POS table constraint rejects over-limit quantities'
);
select is(
  pg_temp.try_execute($sql$insert into public.pos_sales (
    restaurant_id, sale_date, item_name, category, quantity_sold, gross_sales, net_sales, source_pos
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 'Zero sale', 'Test', 0, 10, 9, 'Constraint probe'
  )$sql$),
  false,
  'POS table constraint rejects zero-quantity sales'
);
select is(
  pg_temp.try_execute($sql$insert into public.menu_item_ingredients (
    restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Extreme recipe', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 10001, 'lb'
  )$sql$),
  false,
  'recipe table constraint rejects over-limit baselines'
);
select is(
  pg_temp.try_execute($sql$insert into public.menu_item_ingredients (
    restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Zero recipe', 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', 0, 'lb'
  )$sql$),
  false,
  'recipe table constraint rejects zero baselines'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.reserve_edge_function_invocation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    'sync-pos-sales',
    'pos_sync_requested',
    '{}'::jsonb
  )$sql$),
  false,
  'authenticated clients cannot call the service-only Edge reservation RPC'
);
reset role;

set local role service_role;
create temp table edge_reservation as
select public.reserve_edge_function_invocation(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'sync-pos-sales',
  'pos_sync_requested',
  '{"provider":"square"}'::jsonb
) as payload;
select is(
  (select payload->>'allowed' from edge_reservation),
  'true',
  'trusted Edge execution can reserve for an authorized manager'
);
select is(
  public.record_edge_function_security_event(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    (select (payload->>'reservation_id')::uuid from edge_reservation),
    'sync-pos-sales',
    'completed',
    'pos_sync_queued',
    '{"provider":"square"}'::jsonb
  ),
  true,
  'trusted Edge execution records one terminal event for its reservation'
);
select is(
  public.record_edge_function_security_event(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    (select (payload->>'reservation_id')::uuid from edge_reservation),
    'sync-pos-sales',
    'error',
    'duplicate_terminal',
    '{}'::jsonb
  ),
  false,
  'a reservation cannot create multiple terminal security events'
);
do $$
begin
  for i in 1..7 loop
    perform public.reserve_edge_function_invocation(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '22222222-2222-4222-8222-222222222222',
      'sync-pos-sales',
      'pos_sync_requested',
      jsonb_build_object('attempt', i)
    );
  end loop;
end $$;
select is(
  public.reserve_edge_function_invocation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    'sync-pos-sales',
    'pos_sync_requested',
    '{"provider":"square"}'::jsonb
  )->>'reason',
  'rate_limited',
  'POS sync Edge Function invocation is rate limited'
);
reset role;
select is(
  (
    select count(*)
    from private.edge_function_security_events
    where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and function_name = 'sync-pos-sales'
      and event_type = 'allowed'
  ),
  8::bigint,
  'allowed POS sync security events are recorded privately'
);
select is(
  (
    select count(*)
    from private.edge_function_security_events
    where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and function_name = 'sync-pos-sales'
      and event_type = 'rate_limited'
  ),
  1::bigint,
  'rate limited POS sync security event is recorded privately'
);

set local role service_role;
select is(
  public.reserve_edge_function_invocation(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'link-gmail',
    'gmail_link_started',
    '{"provider":"gmail"}'::jsonb
  )->>'reason',
  'forbidden',
  'staff cannot reserve owner/admin Gmail link workflow'
);
reset role;
select is(
  (
    select count(*)
    from private.edge_function_security_events
    where actor_user_id = '33333333-3333-4333-8333-333333333333'
  ),
  0::bigint,
  'forbidden Edge attempts do not write tenant-attributed ledger rows'
);

select is(
  (select prosecdef from pg_proc function_row join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
   where namespace_row.nspname = 'private' and function_row.proname = 'commit_operational_signals'),
  true,
  'operational signal commit executes with its hardened definer authority'
);
select is(
  (select array_to_string(proconfig, ',') from pg_proc function_row join pg_namespace namespace_row on namespace_row.oid = function_row.pronamespace
   where namespace_row.nspname = 'private' and function_row.proname = 'commit_operational_signals'),
  'search_path=""',
  'operational signal commit pins an empty search path'
);
select is(
  has_function_privilege('authenticated', 'public.replace_pending_purchase_recommendations(uuid,jsonb)', 'execute'),
  false,
  'authenticated clients cannot execute raw recommendation replacement'
);
select is(
  has_function_privilege('authenticated', 'public.replace_operational_insights(uuid,jsonb)', 'execute'),
  false,
  'authenticated clients cannot execute raw insight replacement'
);
select is(
  has_function_privilege('authenticated', 'public.service_commit_operational_signals(uuid,uuid,bigint,jsonb,jsonb,boolean,jsonb)', 'execute'),
  false,
  'authenticated clients cannot execute service-only signal commits'
);
select is(
  has_function_privilege('service_role', 'public.service_commit_operational_signals(uuid,uuid,bigint,jsonb,jsonb,boolean,jsonb)', 'execute'),
  true,
  'service role can execute the guarded signal commit wrapper'
);
select is(
  has_function_privilege('anon', 'public.verify_staging_identity(text)', 'execute'),
  true,
  'anonymous preflight can compare the non-secret staging marker'
);
select is(
  has_table_privilege('authenticated', 'private.restaurant_signal_state', 'select'),
  false,
  'authenticated clients cannot read the private planning revision state'
);

select is(
  has_table_privilege('authenticated', 'private.restaurant_workspace_allocations', 'select'),
  false,
  'authenticated clients cannot read the private workspace allocation ledger'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select lives_ok(
  $sql$create temp table quota_workspaces on commit drop as
    select (
      public.create_restaurant_with_owner('Quota workspace ' || sequence_number::text, 'Test')
    ).id as restaurant_id
    from generate_series(1, 5) sequence_number$sql$,
  'quota owner can create five lifetime workspaces'
);
select is((select count(*) from quota_workspaces), 5::bigint, 'five quota workspaces were created');
reset role;
select lives_ok(
  $sql$insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
    select restaurant_id, '77777777-7777-4777-8777-777777777777', 'owner', 'active'
    from quota_workspaces$sql$,
  'trusted administration can add a replacement active owner'
);
select lives_ok(
  $sql$update public.restaurant_memberships membership
    set status = 'disabled'
    where membership.restaurant_id in (select restaurant_id from quota_workspaces)
      and membership.user_id = '66666666-6666-4666-8666-666666666666'$sql$,
  'trusted administration can disable creators after replacement owners exist'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select is(
  pg_temp.try_execute($sql$select public.create_restaurant_with_owner('Quota bypass attempt', 'Test')$sql$),
  false,
  'membership churn does not release the lifetime workspace quota'
);
reset role;
select is(
  (select count(*) from private.restaurant_workspace_allocations
   where creator_user_id = '66666666-6666-4666-8666-666666666666'),
  5::bigint,
  'immutable allocation ledger retains all five creator allocations'
);
select is(
  (select count(*) from public.restaurant_memberships
   where user_id = '66666666-6666-4666-8666-666666666666' and status = 'disabled'),
  5::bigint,
  'creator memberships are disabled without affecting lifetime allocation history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);
select is(
  pg_temp.try_execute($sql$update public.restaurant_memberships
    set status = 'disabled'
    where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and user_id = '44444444-4444-4444-8444-444444444444'$sql$),
  false,
  'the final active owner cannot disable their membership'
);
reset role;
select is(
  (select status from public.restaurant_memberships
   where restaurant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and user_id = '44444444-4444-4444-8444-444444444444'),
  'active',
  'the final owner guard leaves the membership active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$update public.restaurants set name = 'Direct owner rewrite'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$sql$),
  false,
  'authenticated owners cannot bypass profile validation with direct DML'
);
reset role;
select is(
  (select name from public.restaurants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'Tenant A Updated',
  'denied direct profile DML leaves the restaurant unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    jsonb_build_object('address', repeat('A', 500))
  )$sql$,
  'guarded profile RPC accepts the exact address boundary'
);
reset role;
select is(
  (select length(address) from public.restaurants where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  500,
  'exact-boundary profile update persists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', jsonb_build_object('address', repeat('A', 501))
  )$sql$),
  false,
  'profile RPC rejects a 501-character address'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"logo_url":"http://example.test/logo.png"}'::jsonb
  )$sql$),
  false,
  'profile RPC rejects a non-HTTPS logo URL'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"timezone":"Mars/Olympus_Mons"}'::jsonb
  )$sql$),
  false,
  'profile RPC rejects an unknown timezone'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"unknown_field":true}'::jsonb
  )$sql$),
  false,
  'profile RPC rejects unknown patch fields'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    jsonb_build_object('operational_profile', jsonb_build_object('notes', repeat('N', 2001)))
  )$sql$),
  false,
  'profile RPC rejects operational notes over 2,000 characters'
);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{"name":"Cross tenant rewrite"}'::jsonb
  )$sql$),
  false,
  'profile RPC rejects cross-tenant owner calls'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.update_restaurant_profile(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{"name":"Manager rewrite"}'::jsonb
  )$sql$),
  false,
  'profile RPC rejects manager calls'
);
reset role;

select is(has_table_privilege('authenticated', 'public.ai_insights', 'insert'), false, 'AI insight inserts are server-only');
select is(has_table_privilege('authenticated', 'public.ai_insights', 'update'), false, 'AI insight updates are server-only');
select is(has_table_privilege('authenticated', 'public.ai_insights', 'delete'), false, 'AI insight deletes are server-only');
select is(
  has_function_privilege(
    'authenticated',
    'public.service_create_rules_engine_ai_insight(uuid,uuid,jsonb)',
    'execute'
  ),
  false,
  'authenticated clients cannot call the service-only AI persistence RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$insert into public.ai_insights (
    restaurant_id, source, output, risk_level, confidence, generated_by
  ) values (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'openai_structured_output',
    '{"title":"Forged OpenAI result"}'::jsonb,
    'high', 1, 'openai'
  )$sql$),
  false,
  'authenticated manager cannot forge OpenAI provenance'
);
reset role;

select is(
  has_function_privilege(
    'service_role',
    'public.service_create_rules_engine_ai_insight(uuid,uuid,jsonb)',
    'execute'
  ),
  true,
  'service role can call the guarded AI persistence RPC'
);
set local role service_role;
select lives_ok(
  $sql$select public.service_create_rules_engine_ai_insight(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"title":"Server attested","summary":"Rules-engine placeholder.","recommended_action":"Review inventory.","risk_level":"low","confidence":0.25,"affected_workflow":"inventory","evidence":["Generated by the Edge scaffold."]}'::jsonb
  )$sql$,
  'trusted Edge workflow can persist a structured rules-engine insight'
);
reset role;
select is(
  (select source from public.ai_insights
   where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and output ->> 'title' = 'Server attested'),
  'rules_engine',
  'AI source provenance is server-attested'
);
select is(
  (select generated_by from public.ai_insights
   where restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and output ->> 'title' = 'Server attested'),
  'edge_function_scaffold',
  'AI generator provenance is server-attested'
);
set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_create_rules_engine_ai_insight(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '{"title":"Cross tenant","summary":"Invalid actor.","recommended_action":"None.","risk_level":"low","confidence":0.1,"affected_workflow":"inventory","evidence":[]}'::jsonb
  )$sql$),
  false,
  'service AI RPC rechecks the actor tenant role'
);
select is(
  pg_temp.try_execute($sql$select public.service_create_rules_engine_ai_insight(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{"title":"Malformed","summary":"Missing required output."}'::jsonb
  )$sql$),
  false,
  'service AI RPC rejects malformed structured output'
);
select is(
  pg_temp.try_execute($sql$select public.service_create_rules_engine_ai_insight(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    jsonb_build_object(
      'title', 'Oversized',
      'summary', repeat('S', 17000),
      'recommended_action', 'Reject this output.',
      'risk_level', 'low',
      'confidence', 0.1,
      'affected_workflow', 'inventory',
      'evidence', '[]'::jsonb
    )
  )$sql$),
  false,
  'service AI RPC rejects output over the 16 KiB bound'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$select public.service_record_edge_audit_log(
    '22222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'tenant_isolation_probe',
    'inventory_items',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    '{"source":"pgTAP"}'::jsonb
  )$sql$,
  'service audit RPC accepts a live manager actor for the same tenant'
);
reset role;
select is(
  (select actor_user_id from public.audit_logs where action = 'tenant_isolation_probe'),
  '22222222-2222-4222-8222-222222222222'::uuid,
  'service audit RPC derives the persisted actor from its revalidated subject'
);
set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_record_edge_audit_log(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'cross_tenant_probe',
    'inventory_items',
    'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',
    '{}'::jsonb
  )$sql$),
  false,
  'service audit RPC rejects a forged cross-tenant actor binding'
);
select is(
  pg_temp.try_execute($sql$select public.service_record_edge_audit_log(
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'revoked_actor_probe',
    'inventory_items',
    'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
    '{}'::jsonb
  )$sql$),
  false,
  'service audit RPC rechecks live membership after revocation'
);
reset role;

select is(
  has_table_privilege('authenticated', 'public.restaurant_email_connections', 'INSERT'),
  false,
  'authenticated clients cannot forge a Gmail connection insert'
);
select is(
  has_table_privilege('authenticated', 'public.restaurant_email_connections', 'UPDATE'),
  false,
  'authenticated clients cannot forge connected Gmail state'
);
select is(
  has_table_privilege('authenticated', 'private.gmail_oauth_flows', 'SELECT'),
  false,
  'authenticated clients cannot read Gmail OAuth state or PKCE metadata'
);
select is(
  has_table_privilege('authenticated', 'private.gmail_credentials', 'SELECT'),
  false,
  'authenticated clients cannot read Gmail credential metadata'
);
select is(
  has_table_privilege('authenticated', 'private.supplier_email_deliveries', 'SELECT'),
  false,
  'authenticated clients cannot read private Gmail delivery claims'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_begin_gmail_oauth(uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot invoke the Vault-backed OAuth service RPC'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_complete_supplier_email_send(uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot forge provider acceptance'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_begin_gmail_oauth(
    '11111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'aaaaaaaa-0101-4101-8101-aaaaaaaaaaaa',
    repeat('b', 64),
    repeat('v', 64)
  )$sql$),
  false,
  'Gmail OAuth service rejects a cross-tenant actor binding'
);
select is(
  pg_temp.try_execute($sql$select public.service_begin_gmail_oauth(
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0101-4101-8101-aaaaaaaaaaaa',
    repeat('c', 64),
    repeat('v', 64)
  )$sql$),
  false,
  'staff cannot initiate a Gmail OAuth service flow'
);
select lives_ok(
  $sql$
    with callback_reservation as (
      select (
        public.reserve_edge_function_invocation(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '11111111-1111-4111-8111-111111111111',
          'gmail-oauth-callback',
          'gmail_oauth_callback_reserved',
          '{"source":"pgTAP"}'::jsonb
        )->>'reservation_id'
      )::uuid as id
    )
    select public.service_begin_gmail_oauth(
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      callback_reservation.id,
      repeat('a', 64),
      repeat('v', 64)
    )
    from callback_reservation
  $sql$,
  'owner can create an expiring Vault-backed Gmail OAuth flow'
);
select lives_ok(
  $sql$
    with claimed as (
      select public.service_claim_gmail_oauth(repeat('a', 64)) as payload
    )
    select public.service_complete_gmail_oauth(
      (claimed.payload->>'flowId')::uuid,
      'google-subject-tenant-a',
      'orders@tenant-a.test',
      'mock-refresh-credential-tenant-a',
      array['openid', 'email', 'https://www.googleapis.com/auth/gmail.send']::text[]
    )
    from claimed
  $sql$,
  'single-use OAuth claim stores a mock refresh credential in Vault'
);
reset role;

select is(
  (
    select connection.status || ':' || connection.sender_email
    from public.restaurant_email_connections connection
    where connection.restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and connection.provider = 'gmail'
  ),
  'connected:orders@tenant-a.test',
  'OAuth completion exposes only verified connection metadata'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$select public.service_claim_supplier_email_send(
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',
    'bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb',
    '<mise-bbbbbbbb-3333-4333-8333-bbbbbbbbbbbb@mail.mise.test>'
  )$sql$),
  false,
  'supplier email claim rejects a cross-tenant manager actor'
);
select is(
  pg_temp.try_execute($sql$select public.service_claim_supplier_email_send(
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
    '<mise-aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa@mail.mise.test>'
  )$sql$),
  false,
  'staff cannot claim a supplier email delivery'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$select public.mark_supplier_order_sent(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  )$sql$),
  false,
  'legacy order transition cannot forge sent state before provider acceptance'
);
reset role;

set local role service_role;
select lives_ok(
  $sql$
    with claimed as (
      select public.service_claim_supplier_email_send(
        '22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
        'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
        '<mise-aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa@mail.mise.test>'
      ) as payload
    )
    select public.service_fail_supplier_email_send(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
      (claimed.payload->>'claimToken')::uuid,
      'rejected',
      'mock_provider_rejection'
    )
    from claimed
  $sql$,
  'known provider rejection releases the deterministic delivery for a safe retry'
);
select lives_ok(
  $sql$
    with claimed as (
      select public.service_claim_supplier_email_send(
        '22222222-2222-4222-8222-222222222222',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
        'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
        '<mise-aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa@mail.mise.test>'
      ) as payload
    )
    select public.service_complete_supplier_email_send(
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa',
      (claimed.payload->>'claimToken')::uuid,
      'mock-gmail-provider-message-a'
    )
    from claimed
  $sql$,
  'provider acceptance atomically finalizes the claimed supplier order'
);
reset role;

select is(
  (
    select supplier_order.status || ':' || supplier_order.email_provider || ':' || supplier_order.provider_message_id
    from public.supplier_orders supplier_order
    where supplier_order.id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  ),
  'sent:gmail:mock-gmail-provider-message-a',
  'supplier order becomes sent only with its Gmail provider message id'
);
select is(
  (
    select delivery.status || ':' || delivery.provider_message_id
    from private.supplier_email_deliveries delivery
    where delivery.supplier_order_id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  ),
  'sent:mock-gmail-provider-message-a',
  'private delivery record retains the accepted provider outcome'
);
select ok(
  (
    select delivery.provider_accepted_at is not null
    from private.supplier_email_deliveries delivery
    where delivery.supplier_order_id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  ),
  'provider acceptance time is recorded'
);
select is(
  (
    select audit.metadata->>'provider_message_id'
    from public.audit_logs audit
    where audit.restaurant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and audit.action = 'supplier_order_sent'
    order by audit.created_at desc
    limit 1
  ),
  'mock-gmail-provider-message-a',
  'supplier send audit evidence retains the provider message id'
);
select is(
  (
    select delivery.attempt_count
    from private.supplier_email_deliveries delivery
    where delivery.supplier_order_id = 'aaaaaaaa-3333-4333-8333-aaaaaaaaaaaa'
  ),
  2,
  'idempotent delivery retries increment one bounded claim instead of duplicating rows'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select is(
  pg_temp.try_execute($sql$select count(*) from public.inventory_items$sql$),
  false,
  'unauthenticated users cannot read restaurant inventory'
);
select is(
  pg_temp.try_execute($sql$select count(*) from public.restaurants$sql$),
  false,
  'unauthenticated users cannot read restaurant profiles'
);
reset role;

select * from finish();
rollback;
