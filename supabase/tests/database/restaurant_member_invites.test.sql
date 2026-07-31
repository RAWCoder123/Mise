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
  true,
  'authenticated users can execute create_restaurant_member_invite'
);
select is(
  has_function_privilege('anon', 'public.claim_restaurant_member_invite(text)', 'execute'),
  false,
  'anon cannot execute claim_restaurant_member_invite'
);
select is(
  has_table_privilege('authenticated', 'public.restaurant_member_invites', 'select'),
  false,
  'authenticated cannot select restaurant_member_invites via Data API'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '81818181-8181-4811-8811-818181818181', true);

create temporary table pg_temp.created_invite as
select * from public.create_restaurant_member_invite(
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'invite-join@mise.test',
  'staff',
  24
);

select is(
  (select count(*)::integer from pg_temp.created_invite),
  1,
  'owner can create a member invite'
);
select ok(
  (select char_length(claim_token) = 64 from pg_temp.created_invite),
  'create invite returns a 64-char claim token once'
);
select is(
  (select count(*)::integer from public.list_restaurant_member_invites('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1') where status = 'pending'),
  1,
  'owner can list pending invites'
);

select set_config('request.jwt.claim.sub', '84848484-8484-4844-8844-848484848484', true);
select is(
  pg_temp.try_execute($sql$
    select * from public.create_restaurant_member_invite(
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      'cross@mise.test',
      'staff',
      24
    )
  $sql$),
  false,
  'cross-tenant owner cannot create invites for another restaurant'
);

select set_config('request.jwt.claim.sub', '83838383-8383-4833-8833-838383838383', true);
select is(
  pg_temp.try_execute($sql$
    select public.claim_restaurant_member_invite((select claim_token from pg_temp.created_invite))
  $sql$),
  false,
  'wrong-email account cannot claim invite'
);

select set_config('request.jwt.claim.sub', '82828282-8282-4822-8822-828282828282', true);
select lives_ok(
  $sql$
    select public.claim_restaurant_member_invite((select claim_token from pg_temp.created_invite))
  $sql$,
  'matching Auth email can claim invite'
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
    select public.claim_restaurant_member_invite((select claim_token from pg_temp.created_invite))
  $sql$),
  false,
  'claimed invite cannot be reused'
);

select set_config('request.jwt.claim.sub', '81818181-8181-4811-8811-818181818181', true);
create temporary table pg_temp.revocable_invite as
select * from public.create_restaurant_member_invite(
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'invite-other@mise.test',
  'manager',
  24
);
select lives_ok(
  $sql$
    select public.revoke_restaurant_member_invite(
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      (select id from pg_temp.revocable_invite)
    )
  $sql$,
  'owner can revoke a pending invite'
);

select set_config('request.jwt.claim.sub', '83838383-8383-4833-8833-838383838383', true);
select is(
  pg_temp.try_execute($sql$
    select public.claim_restaurant_member_invite((select claim_token from pg_temp.revocable_invite))
  $sql$),
  false,
  'revoked invite cannot be claimed'
);

select * from finish();
rollback;
