begin;

select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'a1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'acceptance-edit@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('a0000000-0000-4000-8000-000000000001', 'Acceptance Edit Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000001',
  'Avocados', 'Produce', 'case', 4, 12, 6, 28, 'Neighborhood Produce'
);

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status
)
values (
  'a0000000-0000-4000-8000-000000000101',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000011',
  'Avocados', 'Neighborhood Produce', 10, 'case', 'Acceptance edit learning fixture', 'high', 'pending'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'purchase_recommendations_restaurant_acceptance_edit_created_at_idx'
  ),
  'acceptance-edit learning index exists on approved/ordered recommendations'
);

set local role service_role;

select lives_ok(
  $sql$select public.service_approve_purchase_recommendation(
    'a1111111-1111-4111-8111-111111111111',
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000101',
    12
  )$sql$,
  'manager can approve with an edited accepted quantity for learning'
);

select is(
  (select original_recommended_quantity from public.purchase_recommendations where id = 'a0000000-0000-4000-8000-000000000101'),
  10::numeric,
  'edited approval preserves original_recommended_quantity for acceptance-edit learning'
);

select is(
  (select recommended_quantity from public.purchase_recommendations where id = 'a0000000-0000-4000-8000-000000000101'),
  12::numeric,
  'edited approval stores accepted quantity for acceptance-edit learning'
);

select ok(
  (
    select exists (
      select 1
      from jsonb_array_elements(
        public.service_fetch_operational_planning_snapshot(
          'a1111111-1111-4111-8111-111111111111',
          'a0000000-0000-4000-8000-000000000001'
        )->'recommendationHistory'
      ) recommendation
      where recommendation->>'id' = 'a0000000-0000-4000-8000-000000000101'
        and (recommendation->>'original_recommended_quantity')::numeric = 10
        and (recommendation->>'recommended_quantity')::numeric = 12
    )
  ),
  'planning recommendationHistory exposes original vs accepted quantities for learning'
);

select is(
  (
    select count(*)::int
    from jsonb_array_elements(
      public.service_fetch_operational_planning_snapshot(
        'a1111111-1111-4111-8111-111111111111',
        'a0000000-0000-4000-8000-000000000001'
      )->'recommendationHistory'
    ) recommendation
    where recommendation->>'id' = 'a0000000-0000-4000-8000-000000000101'
      and recommendation ? 'original_recommended_quantity'
  ),
  1,
  'recommendationHistory includes original_recommended_quantity key after edited approval'
);

select is(
  has_table_privilege('authenticated', 'public.purchase_recommendations', 'UPDATE'),
  false,
  'authenticated clients cannot rewrite accepted recommendation quantities for learning spoofing'
);

reset role;

select * from finish();
rollback;
