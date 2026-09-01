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
    'a1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sub-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sub-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'sub-other@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('a0000000-0000-4000-8000-000000000001', 'Substitution Kitchen A', 'Fast casual'),
  ('a0000000-0000-4000-8000-000000000002', 'Substitution Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'a2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('a0000000-0000-4000-8000-000000000002', 'a3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity, par_level,
  reorder_threshold, estimated_unit_cost, supplier_name, last_updated,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
)
values
  (
    'a0000000-0000-4000-8000-000000000101',
    'a0000000-0000-4000-8000-000000000001',
    'Chicken thigh', 'Protein', 'lbs', 40, 100, 30, 3.5, 'Protein Co', now(),
    'g', 453.59237, 'verified', now(), 'a1111111-1111-4111-8111-111111111111'
  ),
  (
    'a0000000-0000-4000-8000-000000000102',
    'a0000000-0000-4000-8000-000000000001',
    'Beef strips', 'Protein', 'lbs', 35, 90, 25, 4.1, 'Protein Co', now(),
    'g', 453.59237, 'verified', now(), 'a1111111-1111-4111-8111-111111111111'
  ),
  (
    'a0000000-0000-4000-8000-000000000201',
    'a0000000-0000-4000-8000-000000000002',
    'Other rice', 'Dry goods', 'lbs', 20, 40, 10, 0.9, 'Pantry', now(),
    'g', 453.59237, 'verified', now(), 'a3333333-3333-4333-8333-333333333333'
  );

select is(
  has_function_privilege(
    'authenticated',
    'public.upsert_ingredient_substitution(uuid,uuid,uuid,numeric,numeric,text,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can execute upsert_ingredient_substitution'
);

select is(
  has_table_privilege('authenticated', 'public.ingredient_substitutions', 'INSERT'),
  false,
  'authenticated clients still cannot insert ingredient_substitutions directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'a0000000-0000-4000-8000-000000000102',
      1, 1.1, 'g', null
    )
  $sql$),
  false,
  'staff cannot upsert an ingredient substitution'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$
    select public.upsert_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000002',
      'a0000000-0000-4000-8000-000000000201',
      'a0000000-0000-4000-8000-000000000201',
      1, 1, 'g', null
    )
  $sql$),
  false,
  'a manager cannot upsert another tenant substitution'
);

select is(
  (
    public.upsert_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'a0000000-0000-4000-8000-000000000102',
      1, 1.1, 'g', null
    )
  ).verification_status,
  'draft',
  'a manager can create a draft ingredient substitution'
);

select is(
  (
    public.verify_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000001',
      (
        select id from public.ingredient_substitutions
        where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
        order by created_at desc
        limit 1
      )
    )
  ).verification_status,
  'verified',
  'a manager can verify a draft ingredient substitution'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and action = 'ingredient_substitution.verified'
  ),
  1,
  'verification writes an audit log'
);

select is(
  pg_temp.try_execute($sql$
    select public.upsert_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000101',
      'a0000000-0000-4000-8000-000000000102',
      1, 1.2, 'g',
      (
        select id from public.ingredient_substitutions
        where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
          and verification_status = 'verified'
        limit 1
      )
    )
  $sql$),
  false,
  'verified substitutions cannot be edited'
);

select is(
  (
    public.expire_ingredient_substitution(
      'a0000000-0000-4000-8000-000000000001',
      (
        select id from public.ingredient_substitutions
        where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
          and verification_status = 'verified'
        limit 1
      )
    )
  ).verification_status,
  'expired',
  'a manager can expire a verified ingredient substitution'
);

reset role;
select is(
  (
    select count(*)::int
    from public.ingredient_substitutions
    where restaurant_id = 'a0000000-0000-4000-8000-000000000002'
  ),
  0,
  'cross-tenant upsert attempts leave the other tenant empty'
);

select * from finish();
rollback;
