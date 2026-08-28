begin;

select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'e1111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pos-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'e1222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'pos-manager@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values ('e0000000-0000-4000-8000-000000000001', 'Location Auth Kitchen', 'Fast casual');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  (
    'e0000000-0000-4000-8000-000000000001',
    'e1111111-1111-4111-8111-111111111111',
    'owner',
    'active'
  ),
  (
    'e0000000-0000-4000-8000-000000000001',
    'e1222222-2222-4222-8222-222222222222',
    'manager',
    'active'
  );

insert into public.pos_integrations (
  id, restaurant_id, provider, status
) values (
  'e0000000-0000-4000-8000-000000000101',
  'e0000000-0000-4000-8000-000000000001',
  'square',
  'connected'
);

insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id,
  display_name, timezone, status
) values (
  'e0000000-0000-4000-8000-000000000102',
  'e0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000101',
  'loc-a', 'Square location A', 'UTC', 'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.set_pos_location_status(
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000102',
    'paused'
  )$$,
  '42501',
  'Owner or admin access required',
  'managers cannot authorize or pause POS locations'
);

select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);

select is(
  (public.set_pos_location_status(
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000102',
    'paused'
  )).status,
  'paused',
  'owners can pause an active POS location'
);

select is(
  (select status from public.pos_locations
    where id = 'e0000000-0000-4000-8000-000000000102'),
  'paused',
  'paused status persists on the location row'
);

select throws_ok(
  $$select public.set_pos_location_status(
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000102',
    'disconnected'
  )$$,
  '22023',
  'POS location status must be active or paused',
  'operators cannot set disconnected through the authorize RPC'
);

select is(
  (public.set_pos_location_status(
    'e0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000102',
    'active'
  )).status,
  'active',
  'owners can re-authorize a paused POS location'
);

select ok(
  exists(
    select 1 from public.audit_logs
    where restaurant_id = 'e0000000-0000-4000-8000-000000000001'
      and action = 'pos_location.status_changed'
      and entity_id = 'e0000000-0000-4000-8000-000000000102'
  ),
  'location status changes write an audit log'
);

reset role;

select is(
  (
    select has_table_privilege('authenticated', 'public.pos_locations', 'UPDATE')
  ),
  false,
  'authenticated clients still cannot update pos_locations directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.set_pos_location_status(uuid, uuid, text)',
    'EXECUTE'
  ),
  'authenticated clients may execute set_pos_location_status'
);

select * from finish();
rollback;
