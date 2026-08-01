begin;

select plan(18);

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
    '81818181-8181-4811-8811-818181818181',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invite-owner@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '82828282-8282-4822-8822-828282828282',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invite-join@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '83838383-8383-4833-8833-838383838383',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invite-other@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '84848484-8484-4844-8844-848484848484',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'invite-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'Invite Kitchen A', 'Cafe'),
  ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', 'Invite Kitchen B', 'Bar');

insert into public.users (id, restaurant_id, name, email, role)
values
  ('81818181-8181-4811-8811-818181818181', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'Invite Owner', 'invite-owner@mise.test', 'owner'),
  ('84848484-8484-4844-8844-848484848484', 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', 'Invite Owner B', 'invite-owner-b@mise.test', 'owner');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', '81818181-8181-4811-8811-818181818181', 'owner', 'active'),
  ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', '84848484-8484-4844-8844-848484848484', 'owner', 'active');

select is(
  has_function_privilege('authenticated', 'public.create_restaurant_member_invite(uuid,text,text,integer)', 'execute'),
  false,
  'authenticated clients cannot execute legacy create_restaurant_member_invite'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_create_restaurant_member_invite(uuid,uuid,text,text,integer)',
    'execute'
  ),
  false,
  'authenticated clients cannot execute service_create_restaurant_member_invite'
);
select is(
  has_function_privilege(
    'service_role',
    'public.service_create_restaurant_member_invite(uuid,uuid,text,text,integer)',
    'execute'
  ),
  true,
  'service role can execute service_create_restaurant_member_invite'
);
select is(
  has_function_privilege('anon', 'public.claim_restaurant_member_invite(text)', 'execute'),
  false,
  'anon cannot execute claim_restaurant_member_invite'
);
select is(
  has_function_privilege('authenticated', 'public.claim_restaurant_member_invite(text)', 'execute'),
  false,
  'authenticated clients cannot execute legacy claim_restaurant_member_invite'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.service_claim_restaurant_member_invite(uuid,text)',
    'execute'
  ),
  false,
  'authenticated clients cannot execute service_claim_restaurant_member_invite'
);
select is(
  has_function_privilege(
    'service_role',
    'public.service_claim_restaurant_member_invite(uuid,text)',
    'execute'
  ),
  true,
  'service role can execute service_claim_restaurant_member_invite'
);
select is(
  has_table_privilege('authenticated', 'public.restaurant_member_invites', 'select'),
  false,
  'authenticated cannot select restaurant_member_invites via Data API'
);

set local role service_role;
create temporary table pg_temp.created_invite as
select * from public.service_create_restaurant_member_invite(
  '81818181-8181-4811-8811-818181818181',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'invite-join@mise.test',
  'staff',
  24
);
reset role;

select is(
  (select count(*)::integer from pg_temp.created_invite),
  1,
  'owner actor can create a member invite through the service RPC'
);
select ok(
  (select char_length(claim_token) = 64 from pg_temp.created_invite),
  'create invite returns a 64-char claim token once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81818181-8181-4811-8811-818181818181', true);
select is(
  (select count(*)::integer from public.list_restaurant_member_invites('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1') where status = 'pending'),
  1,
  'owner can list pending invites'
);
reset role;

-- Seed a pending invite that has already passed expires_at without mutating via claim.
insert into public.restaurant_member_invites (
  id,
  restaurant_id,
  email,
  role,
  status,
  token_hash,
  created_by,
  expires_at,
  created_at
)
values (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'stale-invite@mise.test',
  'staff',
  'pending',
  repeat('ab', 32),
  '81818181-8181-4811-8811-818181818181',
  now() - interval '1 day',
  now() - interval '2 days'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81818181-8181-4811-8811-818181818181', true);
select is(
  (
    select status
    from public.list_restaurant_member_invites('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1')
    where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
  ),
  'expired',
  'list returns effective expired status for past-due pending invites'
);
reset role;

select is(
  (
    select status
    from public.restaurant_member_invites
    where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
  ),
  'pending',
  'list does not persist expiry onto the invite row'
);

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    select * from public.service_create_restaurant_member_invite(
      '84848484-8484-4844-8844-848484848484',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      'cross@mise.test',
      'staff',
      24
    )
  $sql$),
  false,
  'cross-tenant owner actor cannot create invites for another restaurant'
);
reset role;

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    select public.service_claim_restaurant_member_invite(
      '83838383-8383-4833-8833-838383838383',
      (select claim_token from pg_temp.created_invite)
    )
  $sql$),
  false,
  'wrong-email account cannot claim invite'
);
select lives_ok(
  $sql$
    select public.service_claim_restaurant_member_invite(
      '82828282-8282-4822-8822-828282828282',
      (select claim_token from pg_temp.created_invite)
    )
  $sql$,
  'matching Auth email can claim invite through the service RPC'
);
select is(
  (
    select count(*)::integer
    from public.restaurant_memberships
    where restaurant_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and user_id = '82828282-8282-4822-8822-828282828282'
      and role = 'staff'
      and status = 'active'
  ),
  1,
  'claim creates an active membership for the invitee'
);
select is(
  pg_temp.try_execute($sql$
    select public.service_claim_restaurant_member_invite(
      '82828282-8282-4822-8822-828282828282',
      (select claim_token from pg_temp.created_invite)
    )
  $sql$),
  false,
  'claimed invite cannot be reused'
);
reset role;

set local role service_role;
create temporary table pg_temp.revocable_invite as
select * from public.service_create_restaurant_member_invite(
  '81818181-8181-4811-8811-818181818181',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'invite-other@mise.test',
  'manager',
  24
);
select lives_ok(
  $sql$
    select public.service_revoke_restaurant_member_invite(
      '81818181-8181-4811-8811-818181818181',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      (select id from pg_temp.revocable_invite)
    )
  $sql$,
  'owner actor can revoke a pending invite through the service RPC'
);
reset role;

set local role service_role;
select is(
  pg_temp.try_execute($sql$
    select public.service_claim_restaurant_member_invite(
      '83838383-8383-4833-8833-838383838383',
      (select claim_token from pg_temp.revocable_invite)
    )
  $sql$),
  false,
  'revoked invite cannot be claimed'
);
reset role;

select * from finish();
rollback;
