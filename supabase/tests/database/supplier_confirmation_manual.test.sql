begin;

select plan(7);

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
    'c1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'confirm-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'confirm-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c3333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'confirm-other@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('c0000000-0000-4000-8000-000000000001', 'Confirmation Kitchen A', 'Fast casual'),
  ('c0000000-0000-4000-8000-000000000002', 'Confirmation Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('c0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('c0000000-0000-4000-8000-000000000001', 'c2222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('c0000000-0000-4000-8000-000000000002', 'c3333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  ('c0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'Confirm Produce', 'confirm produce');

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
)
values (
  'c0000000-0000-4000-8000-000000000201',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000010',
  'Confirm Produce',
  'Sent confirmation-path order',
  'sent',
  current_date + 1
);

select is(
  has_function_privilege(
    'authenticated',
    'public.record_supplier_confirmation(uuid,uuid,text,text,text,timestamptz,jsonb)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can execute record_supplier_confirmation'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_record_supplier_confirmation(uuid,uuid,uuid,text,text,timestamptz,jsonb,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated clients still cannot execute service_record_supplier_confirmation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_supplier_confirmation(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'acknowledged',
      'manual-confirmation-staff',
      'staff-ref',
      now() + interval '1 day',
      '{}'::jsonb
    )
  $sql$),
  false,
  'staff cannot record a supplier confirmation'
);

select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$
    select public.record_supplier_confirmation(
      'c0000000-0000-4000-8000-000000000002',
      'c0000000-0000-4000-8000-000000000999',
      'acknowledged',
      'cross-tenant-confirmation',
      null,
      null,
      '{}'::jsonb
    )
  $sql$),
  false,
  'a manager cannot record another tenant confirmation'
);

select is(
  (
    public.record_supplier_confirmation(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'acknowledged',
      'manual-confirmation-1',
      'mgr-ref-1',
      now() + interval '1 day',
      '{}'::jsonb
    )->>'outcome'
  ),
  'applied',
  'a manager can record a supplier confirmation'
);

select is(
  (
    public.record_supplier_confirmation(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'acknowledged',
      'manual-confirmation-1',
      'mgr-ref-1',
      now() + interval '1 day',
      '{}'::jsonb
    )->>'outcome'
  ),
  'already_applied',
  'manager confirmation replay returns already_applied'
);
reset role;

select is(
  (
    select count(*)
    from public.supplier_order_confirmations
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and idempotency_key = 'manager_confirmation:manual-confirmation-1'
  ),
  1::bigint,
  'manager confirmation replay creates no duplicate row'
);

select * from finish();
rollback;
