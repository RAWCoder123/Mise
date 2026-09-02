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
    'b1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mod-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mod-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mod-other@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('b0000000-0000-4000-8000-000000000001', 'Modifier Kitchen A', 'Fast casual'),
  ('b0000000-0000-4000-8000-000000000002', 'Modifier Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('b0000000-0000-4000-8000-000000000002', 'b3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.menu_items (id, restaurant_id, name, category, active)
values
  ('b0000000-0000-4000-8000-000000000301', 'b0000000-0000-4000-8000-000000000001', 'Avocado Toast', 'Mains', true),
  ('b0000000-0000-4000-8000-000000000302', 'b0000000-0000-4000-8000-000000000002', 'Other Bowl', 'Mains', true);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name, last_updated,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
)
values
  (
    'b0000000-0000-4000-8000-000000000101',
    'b0000000-0000-4000-8000-000000000001',
    'Avocado', 'Produce', 'each', 40, 100, 30, 1.5, 'Produce Co', now(),
    'each', 1, 'verified', now(), 'b1111111-1111-4111-8111-111111111111'
  ),
  (
    'b0000000-0000-4000-8000-000000000201',
    'b0000000-0000-4000-8000-000000000002',
    'Other rice', 'Dry goods', 'lbs', 20, 40, 10, 0.9, 'Pantry', now(),
    'g', 453.59237, 'verified', now(), 'b3333333-3333-4333-8333-333333333333'
  );

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_modifier_recipe_adjustment(uuid,uuid,text,text,uuid,numeric,text,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can execute upsert_modifier_recipe_adjustment'
);

select is(
  has_table_privilege('authenticated', 'public.modifier_recipe_adjustments', 'INSERT'),
  false,
  'authenticated clients still cannot insert modifier_recipe_adjustments directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000301',
      'mod-extra-avo',
      'Extra avocado',
      'b0000000-0000-4000-8000-000000000101',
      1, 'each', null
    )
  $sql$),
  false,
  'staff cannot upsert a modifier recipe adjustment'
);

select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000302',
      'mod-other',
      'Other mod',
      'b0000000-0000-4000-8000-000000000201',
      1, 'g', null
    )
  $sql$),
  false,
  'a manager cannot upsert another tenant modifier adjustment'
);

select lives_ok(
  $sql$
    select public.upsert_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000301',
      'mod-extra-avo',
      'Extra avocado',
      'b0000000-0000-4000-8000-000000000101',
      1, 'each', null
    )
  $sql$,
  'a manager can create a draft modifier recipe adjustment'
);

select is(
  (
    select verification_status
    from public.modifier_recipe_adjustments
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and external_modifier_id = 'mod-extra-avo'
  ),
  'draft',
  'new modifier adjustments start as draft'
);

select lives_ok(
  $sql$
    select public.verify_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.modifier_recipe_adjustments
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and external_modifier_id = 'mod-extra-avo')
    )
  $sql$,
  'a manager can verify a draft modifier recipe adjustment'
);

select is(
  pg_temp.try_execute($sql$
    select public.upsert_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000301',
      'mod-extra-avo',
      'Extra avocado edited',
      'b0000000-0000-4000-8000-000000000101',
      2, 'each',
      (select id from public.modifier_recipe_adjustments
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and external_modifier_id = 'mod-extra-avo')
    )
  $sql$),
  false,
  'verified modifier adjustments cannot be edited'
);

select lives_ok(
  $sql$
    select public.expire_modifier_recipe_adjustment(
      'b0000000-0000-4000-8000-000000000001',
      (select id from public.modifier_recipe_adjustments
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and external_modifier_id = 'mod-extra-avo')
    )
  $sql$,
  'a manager can expire a verified modifier recipe adjustment'
);

select is(
  (
    select verification_status
    from public.modifier_recipe_adjustments
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and external_modifier_id = 'mod-extra-avo'
  ),
  'expired',
  'expired modifier adjustments are marked expired'
);

select * from finish();
rollback;
