begin;

select plan(12);

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
    'authenticated', 'authenticated', 'rec-accept-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('d0000000-0000-4000-8000-000000000001', 'Recommendation Acceptance Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'd0000000-0000-4000-8000-000000000001',
  'd1111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  (
    'd0000000-0000-4000-8000-000000000011',
    'd0000000-0000-4000-8000-000000000001',
    'Avocados', 'Produce', 'case', 4, 10, 6, 28, 'Neighborhood Produce'
  ),
  (
    'd0000000-0000-4000-8000-000000000012',
    'd0000000-0000-4000-8000-000000000001',
    'Limes', 'Produce', 'lb', 8, 20, 12, 2, 'Neighborhood Produce'
  );

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status
)
values
  (
    'd0000000-0000-4000-8000-000000000101',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000011',
    'Avocados', 'Neighborhood Produce', 10, 'case', 'Acceptance edit fixture', 'high', 'pending'
  ),
  (
    'd0000000-0000-4000-8000-000000000102',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000012',
    'Limes', 'Neighborhood Produce', 16, 'lb', 'Acceptance dismiss fixture', 'medium', 'pending'
  );

set local role service_role;

select lives_ok(
  $sql$select public.service_approve_purchase_recommendation(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000101',
    7
  )$sql$,
  'manager can approve with an edited accepted quantity'
);

select is(
  (select original_recommended_quantity from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
  10::numeric,
  'edited approval preserves the original Mise quantity'
);

select is(
  (select recommended_quantity from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
  7::numeric,
  'edited approval stores the accepted quantity for learning and drafts'
);

select lives_ok(
  $sql$select public.service_undo_purchase_recommendation_action(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000101'
  )$sql$,
  'manager can undo an edited approval'
);

select is(
  (select status from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
  'pending',
  'undo returns the recommendation to pending'
);

select is(
  (select recommended_quantity from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
  10::numeric,
  'undo restores the original Mise quantity into recommended_quantity'
);

select is(
  (select original_recommended_quantity from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000101'),
  null,
  'undo clears original_recommended_quantity after restore'
);

select is(
  pg_temp.try_execute($sql$select public.service_dismiss_purchase_recommendation(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000102',
    repeat('x', 241)
  )$sql$),
  false,
  'dismiss rejects reasons longer than 240 characters'
);

select lives_ok(
  $sql$select public.service_dismiss_purchase_recommendation(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000102',
    '  Already covered by walk-in  '
  )$sql$,
  'manager can dismiss with an optional reason'
);

select is(
  (select dismiss_reason from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000102'),
  'Already covered by walk-in',
  'dismiss stores a trimmed reason'
);

select lives_ok(
  $sql$select public.service_undo_purchase_recommendation_action(
    'd1111111-1111-4111-8111-111111111111',
    'd0000000-0000-4000-8000-000000000001',
    'd0000000-0000-4000-8000-000000000102'
  )$sql$,
  'manager can undo a dismissal'
);

select is(
  (select dismiss_reason from public.purchase_recommendations where id = 'd0000000-0000-4000-8000-000000000102'),
  null,
  'undo clears dismiss_reason'
);

reset role;

select * from finish();
rollback;
