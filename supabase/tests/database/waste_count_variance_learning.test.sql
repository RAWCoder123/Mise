begin;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'e1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-learn-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'waste-learn-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('e0000000-0000-4000-8000-000000000001', 'Waste Learning Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('e0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('e0000000-0000-4000-8000-000000000001', 'e2222222-2222-4222-8222-222222222222', 'staff', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'e0000000-0000-4000-8000-000000000011',
  'e0000000-0000-4000-8000-000000000001',
  'Lettuce', 'Produce', 'lb', 20, 30, 10, 1.25, 'Sysco'
);

set local role service_role;

select ok(
  (public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ) ? 'wasteHistory'),
  'planning snapshot includes wasteHistory key'
);

select ok(
  (public.service_fetch_operational_planning_snapshot(
    'e1111111-1111-4111-8111-111111111111',
    'e0000000-0000-4000-8000-000000000001'
  ) ? 'countVarianceHistory'),
  'planning snapshot includes countVarianceHistory key'
);

select is(
  jsonb_typeof(
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'wasteHistory'
  ),
  'array',
  'wasteHistory is a JSON array'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'wasteHistory'
  ),
  0,
  'wasteHistory starts empty before any waste'
);

select lives_ok(
  $sql$
    select public.service_record_inventory_waste_and_signals(
      'e2222222-2222-4222-8222-222222222222',
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      (public.service_fetch_operational_planning_snapshot(
        'e1111111-1111-4111-8111-111111111111',
        'e0000000-0000-4000-8000-000000000001'
      )->>'revision')::bigint,
      3,
      'Outer leaves wilted',
      '[]'::jsonb,
      jsonb_build_array(
        jsonb_build_object(
          'insight_type', 'waste',
          'title', 'Lettuce has a chronic waste pattern',
          'description', 'Recent waste averaged about 10% of on-hand.',
          'why_it_matters', 'Repeated waste reduces usable stock.',
          'recommended_action', 'Review prep and storage for Lettuce.',
          'severity', 'warning'
        )
      )
    );
  $sql$,
  'staff waste recording commits through service path for learning samples'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'wasteHistory'
  ),
  1,
  'snapshot wasteHistory includes the waste sample'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'wasteHistory'->0->>'quantityRemoved'
  )::numeric,
  3::numeric,
  'wasteHistory quantityRemoved matches applied waste qty'
);

insert into public.inventory_movements (
  restaurant_id,
  inventory_item_id,
  actor_user_id,
  reason,
  quantity_before,
  quantity_after,
  source_workflow,
  metadata
)
values (
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000011',
  'e1111111-1111-4111-8111-111111111111',
  'manual_count',
  17,
  14,
  'approve_count_session',
  jsonb_build_object(
    'session_id', 'e0000000-0000-4000-8000-000000000501',
    'system_quantity_at_start', 17,
    'variance_from_system', -3
  )
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'countVarianceHistory'
  ),
  1,
  'snapshot countVarianceHistory includes negative count variance'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'e1111111-1111-4111-8111-111111111111',
      'e0000000-0000-4000-8000-000000000001'
    )->'countVarianceHistory'->0->>'variance'
  )::numeric,
  (-3)::numeric,
  'countVarianceHistory variance matches shrink amount'
);

select is(
  (
    select count(*)::integer
    from public.insights
    where restaurant_id = 'e0000000-0000-4000-8000-000000000001'
      and insight_type = 'waste'
  ),
  1,
  'waste insight is committed through signal path'
);

reset role;

select * from finish();
rollback;
