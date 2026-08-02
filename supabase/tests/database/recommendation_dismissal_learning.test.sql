begin;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'b1111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'dismissal-learning@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('b0000000-0000-4000-8000-000000000001', 'Dismissal Learning Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'b0000000-0000-4000-8000-000000000011',
  'b0000000-0000-4000-8000-000000000001',
  'Avocados', 'Produce', 'case', 4, 12, 6, 28, 'Neighborhood Produce'
);

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status
)
values (
  'b0000000-0000-4000-8000-000000000101',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000011',
  'Avocados', 'Neighborhood Produce', 10, 'case', 'Dismissal learning fixture', 'high', 'pending'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'purchase_recommendations_restaurant_dismissal_learning_created_at_idx'
  ),
  'dismissal learning index exists on dismissed recommendations with reasons'
);

set local role service_role;

select lives_ok(
  $sql$select public.service_dismiss_purchase_recommendation(
    'b1111111-1111-4111-8111-111111111111',
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000101',
    'Already have enough on hand'
  )$sql$,
  'manager can dismiss with a reason for dismissal clustering'
);

select is(
  (select dismiss_reason from public.purchase_recommendations where id = 'b0000000-0000-4000-8000-000000000101'),
  'Already have enough on hand',
  'dismissal stores dismiss_reason for clustering'
);

select ok(
  (
    select exists (
      select 1
      from jsonb_array_elements(
        public.service_fetch_operational_planning_snapshot(
          'b1111111-1111-4111-8111-111111111111',
          'b0000000-0000-4000-8000-000000000001'
        )->'recommendationHistory'
      ) recommendation
      where recommendation->>'id' = 'b0000000-0000-4000-8000-000000000101'
        and recommendation->>'status' = 'dismissed'
        and recommendation->>'dismiss_reason' = 'Already have enough on hand'
    )
  ),
  'planning recommendationHistory exposes dismiss_reason for learning'
);

select is(
  has_table_privilege('authenticated', 'public.purchase_recommendations', 'UPDATE'),
  false,
  'authenticated clients cannot rewrite dismiss_reason for learning spoofing'
);

reset role;

select * from finish();
rollback;
