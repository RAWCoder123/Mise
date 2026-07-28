begin;

select plan(17);

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
    'authenticated', 'authenticated', 'provider-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'provider-staff@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('c0000000-0000-4000-8000-000000000001', 'Provider Control Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  (
    'c0000000-0000-4000-8000-000000000001',
    'c1111111-1111-4111-8111-111111111111',
    'manager',
    'active'
  ),
  (
    'c0000000-0000-4000-8000-000000000001',
    'c2222222-2222-4222-8222-222222222222',
    'staff',
    'active'
  );

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
)
values (
  'c0000000-0000-4000-8000-000000000201',
  'c0000000-0000-4000-8000-000000000001',
  'Provider Test Supplier',
  'Provider control proof',
  'draft',
  current_date + 1
);

select is(
  (select ordering_policy from public.system_operational_controls where singleton),
  'off',
  'global ordering policy defaults off'
);

select is(
  (
    select ordering_policy
    from public.restaurant_operational_controls
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
  ),
  'off',
  'restaurant ordering policy defaults off'
);

select is(
  pg_temp.try_execute($sql$
    update public.system_operational_controls
    set order_drafting_enabled = true
    where singleton
  $sql$),
  false,
  'global order drafting cannot be enabled while policy is off'
);

select is(
  pg_temp.try_execute($sql$
    update public.restaurant_operational_controls
    set order_drafting_enabled = true
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
  $sql$),
  false,
  'restaurant order drafting cannot be enabled while policy is off'
);

select lives_ok(
  $sql$
    update public.system_operational_controls
    set ordering_policy = 'draft_only', order_drafting_enabled = true
    where singleton
  $sql$,
  'global draft-only policy permits manager-controlled draft generation'
);

select lives_ok(
  $sql$
    update public.restaurant_operational_controls
    set ordering_policy = 'draft_only', order_drafting_enabled = true
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
  $sql$,
  'restaurant draft-only policy permits manager-controlled draft generation'
);

select is(
  has_function_privilege(
    'service_role',
    'private.service_claim_supplier_email_send_unchecked(uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'service role cannot bypass the guarded provider claim'
);

set local role service_role;
select is(
  (
    public.service_claim_supplier_email_send(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-000000000201',
      '<mise-provider-control@mise.test>'
    )->>'outcome'
  ),
  'provider_not_enabled',
  'default global and restaurant Gmail switches block delivery'
);
reset role;

select is(
  (select count(*) from private.supplier_email_deliveries),
  0::bigint,
  'disabled provider claim creates no delivery evidence'
);

update public.restaurant_operational_controls
set gmail_delivery_enabled = true
where restaurant_id = 'c0000000-0000-4000-8000-000000000001';

set local role service_role;
select is(
  (
    public.service_claim_supplier_email_send(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-000000000201',
      '<mise-provider-control@mise.test>'
    )->>'outcome'
  ),
  'provider_not_enabled',
  'restaurant Gmail enablement cannot bypass the global switch'
);
reset role;

update public.system_operational_controls
set gmail_delivery_enabled = true
where singleton;

set local role service_role;
select is(
  (
    public.service_claim_supplier_email_send(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-000000000201',
      '<mise-provider-control@mise.test>'
    )->>'outcome'
  ),
  'gmail_not_connected',
  'both database switches are required before ordinary provider validation'
);
reset role;

select is(
  (select count(*) from private.supplier_email_deliveries),
  0::bigint,
  'missing Gmail connection still creates no delivery evidence'
);

update public.system_operational_controls
set operational_mode = 'integrations_paused'
where singleton;

set local role service_role;
select is(
  (
    public.service_claim_supplier_email_send(
      'c1111111-1111-4111-8111-111111111111',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-000000000201',
      '<mise-provider-control@mise.test>'
    )->>'outcome'
  ),
  'provider_not_enabled',
  'integrations-paused mode blocks delivery even when both switches are on'
);
select is(
  pg_temp.try_execute($sql$
    select public.service_claim_supplier_email_send(
      'c2222222-2222-4222-8222-222222222222',
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000201',
      'c0000000-0000-4000-8000-000000000201',
      '<mise-provider-control@mise.test>'
    )
  $sql$),
  false,
  'actor authorization precedes disabled-provider state'
);
reset role;

select is(
  (select count(*) from private.supplier_email_deliveries),
  0::bigint,
  'paused and unauthorized claims create no delivery evidence'
);

select is(
  (
    select status
    from public.supplier_orders
    where id = 'c0000000-0000-4000-8000-000000000201'
  ),
  'draft',
  'all blocked provider claims leave the order as a draft'
);

select is(
  (
    select provider_message_id
    from public.supplier_orders
    where id = 'c0000000-0000-4000-8000-000000000201'
  ),
  null::text,
  'all blocked provider claims leave provider evidence empty'
);

select * from finish();
rollback;
