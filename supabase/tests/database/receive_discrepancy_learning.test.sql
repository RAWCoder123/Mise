begin;

select plan(10);

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
    'authenticated', 'authenticated', 'shortship-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'shortship-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('d0000000-0000-4000-8000-000000000001', 'Shortship Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('d0000000-0000-4000-8000-000000000001', 'd1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('d0000000-0000-4000-8000-000000000001', 'd2222222-2222-4222-8222-222222222222', 'staff', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'd0000000-0000-4000-8000-000000000011',
  'd0000000-0000-4000-8000-000000000001',
  'Tomatoes', 'Produce', 'lb', 4, 20, 8, 1.5, 'Sysco'
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, operator_note, status, delivery_date
)
values (
  'd0000000-0000-4000-8000-000000000201',
  'd0000000-0000-4000-8000-000000000001',
  'Sysco', 'Short-ship learning order', null, 'sent', current_date + 1
);

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, supplier_order_id, generation_source
)
values (
  'd0000000-0000-4000-8000-000000000301',
  'd0000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000011',
  'Tomatoes', 'Sysco', 10, 'lb', 'Below par', 'high', 'ordered',
  'd0000000-0000-4000-8000-000000000201', 'mise_rules'
);

set local role service_role;

select ok(
  (public.service_fetch_operational_planning_snapshot(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001'
  ) ? 'receivingHistory'),
  'planning snapshot includes receivingHistory key'
);

select is(
  jsonb_typeof(
    public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->'receivingHistory'
  ),
  'array',
  'receivingHistory is a JSON array'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->'receivingHistory'
  ),
  0,
  'receivingHistory starts empty before any receive'
);

select ok(
  not pg_temp.try_execute(
    $sql$
      select public.service_receive_supplier_order_and_signals(
        'd2222222-2222-4222-8222-222222222222',
        'd0000000-0000-4000-8000-000000000001',
        'd0000000-0000-4000-8000-000000000201',
        (public.service_fetch_operational_planning_snapshot(
          'd1111111-1111-4111-8111-111111111111',
          'd0000000-0000-4000-8000-000000000001'
        )->>'revision')::bigint,
        jsonb_build_array(
          jsonb_build_object(
            'inventory_item_id', 'd0000000-0000-4000-8000-000000000011',
            'quantity_received', 8
          )
        ),
        '[]'::jsonb,
        '[]'::jsonb
      );
    $sql$
  ),
  'staff cannot receive supplier orders'
);

select lives_ok(
  $sql$
    select public.service_receive_supplier_order_and_signals(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001',
      'd0000000-0000-4000-8000-000000000201',
      (public.service_fetch_operational_planning_snapshot(
        'd1111111-1111-4111-8111-111111111111',
        'd0000000-0000-4000-8000-000000000001'
      )->>'revision')::bigint,
      jsonb_build_array(
        jsonb_build_object(
          'inventory_item_id', 'd0000000-0000-4000-8000-000000000011',
          'quantity_received', 8
        )
      ),
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'insight_type', 'ordering',
          'title', 'Tomatoes is often short-shipped',
          'description', 'Recent Sysco deliveries averaged about 80% of ordered.',
          'why_it_matters', 'Chronic short-ships create stockouts.',
          'recommended_action', 'Order slightly more from Sysco.',
          'severity', 'warning'
        )
      )
    );
  $sql$,
  'manager receive commits short-ship insight payload'
);

select is(
  (
    select count(*)::integer
    from public.inventory_movements
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and reason = 'receiving'
      and (metadata->>'discrepancy')::numeric = -2
  ),
  1,
  'receive ledger stores ordered-versus-received discrepancy'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->'receivingHistory'
  ),
  1,
  'snapshot receivingHistory includes the receive sample'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->'receivingHistory'->0->>'quantityOrdered'
  )::numeric,
  10::numeric,
  'receivingHistory quantityOrdered matches accepted ordered qty'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'd1111111-1111-4111-8111-111111111111',
      'd0000000-0000-4000-8000-000000000001'
    )->'receivingHistory'->0->>'quantityReceived'
  )::numeric,
  8::numeric,
  'receivingHistory quantityReceived matches receive payload'
);

select is(
  (
    select count(*)::integer
    from public.insights
    where restaurant_id = 'd0000000-0000-4000-8000-000000000001'
      and insight_type = 'ordering'
  ),
  1,
  'ordering short-ship insight is committed through signal path'
);

reset role;

select * from finish();
rollback;
