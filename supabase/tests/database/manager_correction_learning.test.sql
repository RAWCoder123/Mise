begin;

select plan(10);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'f1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'manager-correction@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('f0000000-0000-4000-8000-000000000001', 'Manager Correction Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000001',
  'Heavy cream', 'Dairy', 'qt', 20, 30, 10, 3.25, 'Dairy Co'
);

set local role service_role;

select ok(
  (public.service_fetch_operational_planning_snapshot(
    'f1111111-1111-4111-8111-111111111111',
    'f0000000-0000-4000-8000-000000000001'
  ) ? 'managerCorrectionHistory'),
  'planning snapshot includes managerCorrectionHistory key'
);

select is(
  jsonb_typeof(
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'
  ),
  'array',
  'managerCorrectionHistory is a JSON array'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'
  ),
  0,
  'managerCorrectionHistory starts empty before corrections'
);

select lives_ok(
  $sql$
    select public.service_update_inventory_and_signals(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      (public.service_fetch_operational_planning_snapshot(
        'f1111111-1111-4111-8111-111111111111',
        'f0000000-0000-4000-8000-000000000001'
      )->>'revision')::bigint,
      jsonb_build_object('current_quantity', 15, 'note', 'Corrected after manager count'),
      '[]'::jsonb,
      '[]'::jsonb
    );
  $sql$,
  'manager correction update commits through service path'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'
  ),
  1,
  'snapshot managerCorrectionHistory includes downward correction'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'->0->>'quantityBefore'
  )::numeric,
  20::numeric,
  'managerCorrectionHistory quantityBefore matches system quantity'
);

select is(
  (
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'->0->>'variance'
  )::numeric,
  (-5)::numeric,
  'managerCorrectionHistory variance matches downward correction'
);

select lives_ok(
  $sql$
    select public.service_update_inventory_and_signals(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000011',
      (public.service_fetch_operational_planning_snapshot(
        'f1111111-1111-4111-8111-111111111111',
        'f0000000-0000-4000-8000-000000000001'
      )->>'revision')::bigint,
      jsonb_build_object('current_quantity', 18, 'note', 'Found backup case'),
      '[]'::jsonb,
      '[]'::jsonb
    );
  $sql$,
  'upward manager correction still commits through service path'
);

select is(
  jsonb_array_length(
    public.service_fetch_operational_planning_snapshot(
      'f1111111-1111-4111-8111-111111111111',
      'f0000000-0000-4000-8000-000000000001'
    )->'managerCorrectionHistory'
  ),
  1,
  'managerCorrectionHistory ignores upward corrections'
);

select isnt(
  to_regclass('public.inventory_movements_restaurant_manager_correction_created_at_idx'),
  null,
  'manager correction partial index exists'
);

reset role;

select * from finish();
rollback;
