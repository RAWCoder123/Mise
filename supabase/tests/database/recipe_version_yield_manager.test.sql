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
    'authenticated', 'authenticated', 'yield-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'yield-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'yield-other@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('b0000000-0000-4000-8000-000000000001', 'Yield Kitchen A', 'Fast casual'),
  ('b0000000-0000-4000-8000-000000000002', 'Yield Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('b0000000-0000-4000-8000-000000000002', 'b3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.menu_items (id, restaurant_id, name, active)
values
  ('b0000000-0000-4000-8000-000000000101', 'b0000000-0000-4000-8000-000000000001', 'Chicken Bowl', true),
  ('b0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000002', 'Other Bowl', true);

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_recipe_version_yields(uuid,uuid,numeric,numeric,numeric,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can execute upsert_recipe_version_yields'
);

select is(
  has_table_privilege('authenticated', 'public.recipe_versions', 'INSERT'),
  false,
  'authenticated clients still cannot insert recipe_versions directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000101',
      1, 0.95, 0.9, null
    )
  $sql$),
  false,
  'staff cannot upsert recipe yields'
);

select set_config('request.jwt.claim.sub', 'b1111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000201',
      1, 0.95, 0.9, null
    )
  $sql$),
  false,
  'a manager cannot upsert another tenant recipe yield'
);

select lives_ok(
  $sql$
    select public.upsert_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000101',
      1, 0.95, 0.9, null
    )
  $sql$,
  'a manager can create a draft recipe yield'
);

select is(
  (
    select status
    from public.recipe_versions
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and menu_item_id = 'b0000000-0000-4000-8000-000000000101'
    order by version_number desc
    limit 1
  ),
  'draft',
  'created recipe yield starts as draft'
);

select lives_ok(
  $sql$
    select public.verify_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000001',
      (
        select id
        from public.recipe_versions
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and menu_item_id = 'b0000000-0000-4000-8000-000000000101'
          and status = 'draft'
        limit 1
      )
    )
  $sql$,
  'a manager can verify a draft recipe yield'
);

select is(
  pg_temp.try_execute($sql$
    select public.upsert_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000001',
      'b0000000-0000-4000-8000-000000000101',
      1, 0.9, 0.9,
      (
        select id
        from public.recipe_versions
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and menu_item_id = 'b0000000-0000-4000-8000-000000000101'
          and status = 'verified'
        limit 1
      )
    )
  $sql$),
  false,
  'verified recipe yields cannot be edited in place'
);

select lives_ok(
  $sql$
    select public.retire_recipe_version_yields(
      'b0000000-0000-4000-8000-000000000001',
      (
        select id
        from public.recipe_versions
        where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
          and menu_item_id = 'b0000000-0000-4000-8000-000000000101'
          and status = 'verified'
        limit 1
      )
    )
  $sql$,
  'a manager can retire a verified recipe yield'
);

select is(
  (
    select status
    from public.recipe_versions
    where restaurant_id = 'b0000000-0000-4000-8000-000000000001'
      and menu_item_id = 'b0000000-0000-4000-8000-000000000101'
    order by updated_at desc
    limit 1
  ),
  'retired',
  'retired recipe yield status is retired'
);

select * from finish();
rollback;
