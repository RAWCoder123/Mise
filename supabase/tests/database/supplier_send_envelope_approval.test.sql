begin;

select plan(12);

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

select is(
  has_function_privilege(
    'anon',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot approve a supplier send envelope'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  true,
  'authenticated callers can reach the role-checked approval boundary'
);
select is(
  has_function_privilege(
    'service_role',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'the service role cannot forge a user envelope approval'
);
select is(
  has_function_privilege(
    'service_role',
    'private.service_claim_supplier_email_send(uuid,uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  true,
  'the provider boundary remains callable only through the guarded claim'
);
select like(
  pg_get_functiondef(
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)'::regprocedure
  ),
  '%approvedEnvelope%',
  'approval persists the reviewed delivery envelope'
);
select like(
  pg_get_functiondef(
    'private.service_claim_supplier_email_send(uuid,uuid,uuid,uuid,text)'::regprocedure
  ),
  '%approved_envelope%approval_required%service_claim_supplier_email_send_unchecked%',
  'the atomic provider claim rejects missing or stale envelope approval before delivery'
);
select like(
  pg_get_functiondef(
    'private.service_claim_supplier_email_send_unchecked(uuid,uuid,uuid,uuid,text)'::regprocedure
  ),
  '%lower(trim(recipient.supplier_name)) = lower(trim(order_row.supplier_name))%',
  'provider delivery resolves the same normalized supplier identity as review'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'ab111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'envelope-manager@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type)
values ('ab000000-0000-4000-8000-000000000001', 'Envelope Kitchen', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'ab000000-0000-4000-8000-000000000001',
  'ab111111-1111-4111-8111-111111111111',
  'manager',
  'active'
);

insert into public.restaurant_email_connections (
  restaurant_id, provider, status, sender_email, last_verified_at
)
values (
  'ab000000-0000-4000-8000-000000000001',
  'gmail', 'connected', 'orders@envelope.test', now()
);

insert into public.supplier_recipients (restaurant_id, supplier_name, email)
values (
  'ab000000-0000-4000-8000-000000000001',
  'envelope produce', 'first@produce.test'
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
)
values (
  'ab000000-0000-4000-8000-000000000201',
  'ab000000-0000-4000-8000-000000000001',
  'Envelope Produce', 'Ten cases of tomatoes', 'draft', current_date + 1
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    public.approve_supplier_send_envelope(
      'ab000000-0000-4000-8000-000000000001',
      (
        select id from public.mise_actions
        where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
          and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
      ),
      'ab000000-0000-4000-8000-000000000201',
      'orders@envelope.test',
      'first@produce.test',
      'Envelope Kitchen order for Envelope Produce'
    )
  ).status,
  'approved',
  'a manager can approve the exact visible envelope'
);
reset role;

select is(
  (
    select expected_impact->'approvedEnvelope'->>'to'
    from public.mise_actions
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
  ),
  'first@produce.test',
  'the action records the approved recipient'
);
select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and action = 'supplier_send_envelope_approved'
  ),
  1::bigint,
  'the envelope review leaves tenant-scoped audit evidence'
);

update public.supplier_recipients
set email = 'changed@produce.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and lower(trim(supplier_name)) = 'envelope produce';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($sql$
    select public.approve_supplier_send_envelope(
      'ab000000-0000-4000-8000-000000000001',
      (
        select id from public.mise_actions
        where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
          and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
      ),
      'ab000000-0000-4000-8000-000000000201',
      'orders@envelope.test',
      'first@produce.test',
      'Envelope Kitchen order for Envelope Produce'
    )
  $sql$),
  false,
  'a changed recipient invalidates the prior review'
);
reset role;

select is(
  (
    select expected_impact->'approvedEnvelope'->>'to'
    from public.mise_actions
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
  ),
  'first@produce.test',
  'a failed stale review does not overwrite the approved envelope'
);

select * from finish();
rollback;
