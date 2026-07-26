begin;

select plan(14);

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
    'f1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'canonical-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'f2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'canonical-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('f0000000-0000-4000-8000-000000000001', 'Canonical Kitchen A', 'Fast casual'),
  ('f0000000-0000-4000-8000-000000000002', 'Canonical Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('f0000000-0000-4000-8000-000000000001', 'f1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('f0000000-0000-4000-8000-000000000001', 'f2222222-2222-4222-8222-222222222222', 'staff', 'active');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values
  ('f0000000-0000-4000-8000-000000000011', 'f0000000-0000-4000-8000-000000000001', 'Chicken', 'Protein', 'lb', 10, 20, 5, 4, 'Supplier A'),
  ('f0000000-0000-4000-8000-000000000012', 'f0000000-0000-4000-8000-000000000001', 'Eggs', 'Dairy', 'case', 2, 4, 1, 30, 'Supplier A'),
  ('f0000000-0000-4000-8000-000000000021', 'f0000000-0000-4000-8000-000000000002', 'Coffee', 'Beverage', 'case', 2, 4, 1, 40, 'Supplier B');

select is(
  (select canonical_unit from public.inventory_items where id = 'f0000000-0000-4000-8000-000000000011'),
  'g',
  'standard mass units normalize to grams'
);
select is(
  (select canonical_unit_verification_status from public.inventory_items where id = 'f0000000-0000-4000-8000-000000000011'),
  'verified',
  'deterministic standard units are marked verified'
);
select is(
  (select canonical_unit from public.inventory_items where id = 'f0000000-0000-4000-8000-000000000012'),
  null,
  'item-specific package units do not infer a canonical dimension'
);
select is(
  (select canonical_unit_verification_status from public.inventory_items where id = 'f0000000-0000-4000-8000-000000000012'),
  'draft',
  'ambiguous package units remain draft'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.verify_inventory_item_canonical_unit(uuid,uuid,text)',
    'EXECUTE'
  ),
  true,
  'authenticated operators can call the guarded verification RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.verify_inventory_item_canonical_unit(uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute canonical verification'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.verify_inventory_item_canonical_unit(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000012',
      'each'
    )
  $sql$),
  false,
  'staff cannot verify a canonical unit'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000012',
      'count', 24, 'each', now(), 'manual_count',
      'canonical-unverified-1', 'canonical-unverified-1'
    )
  $sql$),
  false,
  'unverified package items cannot create authoritative events'
);
select is(
  pg_temp.try_execute($sql$
    select public.verify_inventory_item_canonical_unit(
      'f0000000-0000-4000-8000-000000000002',
      'f0000000-0000-4000-8000-000000000021',
      'each'
    )
  $sql$),
  false,
  'a manager cannot verify another restaurant item'
);
select is(
  (public.verify_inventory_item_canonical_unit(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000012',
    'each'
  )).canonical_unit,
  'each',
  'a manager can verify a scoped package item'
);
select is(
  pg_temp.try_execute($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000012',
      'count', 24, 'g', now(), 'manual_count',
      'canonical-mismatch-1', 'canonical-mismatch-1'
    )
  $sql$),
  false,
  'event units cannot differ from the verified item unit'
);
select ok(
  (public.record_inventory_event(
    'f0000000-0000-4000-8000-000000000001',
    'f0000000-0000-4000-8000-000000000012',
    'count', 24, 'each', now(), 'manual_count',
    'canonical-match-1', 'canonical-match-1'
  )).id is not null,
  'a verified matching unit can create an authoritative event'
);
reset role;

select is(
  (
    select count(*)
    from public.audit_logs
    where action = 'inventory_item.canonical_unit_verified'
      and restaurant_id = 'f0000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'canonical verification records one audit entry'
);
select is(
  has_table_privilege('authenticated', 'public.inventory_items', 'UPDATE'),
  false,
  'authenticated clients cannot directly update canonical authority'
);

select * from finish();
rollback;
