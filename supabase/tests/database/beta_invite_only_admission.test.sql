begin;

select plan(19);

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
values (
  'a5111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'invite-owner@mise.test',
  crypt('password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select is(
  has_function_privilege(
    'authenticated',
    'public.create_restaurant_with_owner(text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot allocate restaurant tenants'
);

select is(
  has_function_privilege(
    'service_role',
    'public.create_restaurant_with_owner(text,text)',
    'EXECUTE'
  ),
  false,
  'service automation cannot use the legacy self-service allocator'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.service_provision_beta_restaurant(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated users cannot call beta provisioning'
);

select is(
  has_function_privilege(
    'anon',
    'public.service_provision_beta_restaurant(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous users cannot call beta provisioning'
);

select is(
  has_function_privilege(
    'service_role',
    'public.service_provision_beta_restaurant(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  true,
  'only service administration receives the beta provisioning RPC'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"a5111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select is(
  pg_temp.try_execute($sql$
    select public.create_restaurant_with_owner('Unauthorized Kitchen', 'Test')
  $sql$),
  false,
  'a signed-in operator cannot bypass the revoked allocation grant'
);
reset role;

set local role service_role;
create temporary table provisioned_beta_restaurant on commit drop as
select *
from public.service_provision_beta_restaurant(
  'a5111111-1111-4111-8111-111111111111',
  'Invite Kitchen',
  'Fast casual',
  'a5000000-0000-4000-8000-000000000001'
);
reset role;

select is(
  (select count(*) from provisioned_beta_restaurant),
  1::bigint,
  'service administration provisions one restaurant'
);

select is(
  (
    select count(*)
    from public.restaurant_memberships membership
    join provisioned_beta_restaurant restaurant
      on restaurant.id = membership.restaurant_id
    where membership.user_id = 'a5111111-1111-4111-8111-111111111111'
      and membership.role = 'owner'
      and membership.status = 'active'
  ),
  1::bigint,
  'the provisioned Auth identity receives one active owner membership'
);

select is(
  (
    select count(*)
    from private.restaurant_workspace_allocations allocation
    join provisioned_beta_restaurant restaurant
      on restaurant.id = allocation.restaurant_id
    where allocation.creator_user_id = 'a5111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'admin provisioning remains inside the lifetime workspace quota'
);

select is(
  (
    select count(*)
    from private.beta_restaurant_provisioning_requests request
    join provisioned_beta_restaurant restaurant
      on restaurant.id = request.restaurant_id
    where request.idempotency_key = 'a5000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'the accepted request records durable idempotency evidence'
);

select is(
  (
    select row(
      controls.square_sync_enabled,
      controls.square_webhooks_enabled,
      controls.gmail_delivery_enabled,
      controls.insight_generation_enabled,
      controls.order_drafting_enabled,
      controls.stripe_invoicing_enabled,
      controls.ordering_policy
    )::text
    from public.restaurant_operational_controls controls
    join provisioned_beta_restaurant restaurant
      on restaurant.id = controls.restaurant_id
  ),
  '(f,f,f,f,f,f,off)',
  'every provider and ordering capability starts safely disabled'
);

set local role service_role;
select is(
  (
    select replay.id
    from public.service_provision_beta_restaurant(
      'a5111111-1111-4111-8111-111111111111',
      'Invite Kitchen',
      'Fast casual',
      'a5000000-0000-4000-8000-000000000001'
    ) replay
  ),
  (select id from provisioned_beta_restaurant),
  'an exact retry returns the original restaurant'
);
reset role;

select is(
  (
    select count(*)
    from public.restaurant_memberships
    where user_id = 'a5111111-1111-4111-8111-111111111111'
      and role = 'owner'
      and status = 'active'
  ),
  1::bigint,
  'an exact retry cannot duplicate ownership'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    select public.service_provision_beta_restaurant(
      'a5111111-1111-4111-8111-111111111111',
      'Conflicting Kitchen',
      'Fast casual',
      'a5000000-0000-4000-8000-000000000001'
    )
  $sql$),
  false,
  'a changed payload cannot reuse accepted idempotency authority'
);

select is(
  pg_temp.try_execute($sql$
    select public.service_provision_beta_restaurant(
      'a5999999-9999-4999-8999-999999999999',
      'Missing Owner Kitchen',
      'Fast casual',
      'a5000000-0000-4000-8000-000000000002'
    )
  $sql$),
  false,
  'provisioning fails closed for a nonexistent Auth user'
);

select is(
  pg_temp.try_execute($sql$
    select public.service_provision_beta_restaurant(
      'a5111111-1111-4111-8111-111111111111',
      repeat('x', 121),
      'Fast casual',
      'a5000000-0000-4000-8000-000000000003'
    )
  $sql$),
  false,
  'provisioning rejects an unbounded restaurant name'
);

select is(
  pg_temp.try_execute($sql$
    select public.service_provision_beta_restaurant(
      'a5111111-1111-4111-8111-111111111111',
      'Invite Kitchen',
      'Conflicting cuisine',
      'a5000000-0000-4000-8000-000000000004'
    )
  $sql$),
  false,
  'same-owner same-name provisioning rejects conflicting restaurant data'
);
reset role;

select is(
  (
    select count(*)
    from public.restaurants
    where name in ('Invite Kitchen', 'Conflicting Kitchen', 'Missing Owner Kitchen')
  ),
  1::bigint,
  'failed and replayed requests create no extra tenant'
);

select is(
  (
    select count(*)
    from private.beta_restaurant_provisioning_requests
    where owner_user_id = 'a5111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'only accepted provisioning requests leave durable evidence'
);

select * from finish();

rollback;
