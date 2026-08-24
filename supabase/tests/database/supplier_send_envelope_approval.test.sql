begin;

select plan(27);

select is(
  has_function_privilege(
    'anon',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot invoke the retired envelope-only approval boundary'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated callers cannot invoke the retired envelope-only approval boundary'
);
select is(
  has_function_privilege(
    'service_role',
    'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  false,
  'the service role cannot forge an envelope-only approval'
);

select is(
  has_function_privilege(
    'anon',
    'public.preview_supplier_send_content(uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot preview supplier send content'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.preview_supplier_send_content(uuid,uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated members can reach the tenant-checked content preview boundary'
);
select is(
  has_function_privilege(
    'service_role',
    'public.preview_supplier_send_content(uuid,uuid)',
    'EXECUTE'
  ),
  false,
  'the service role cannot bypass the member content preview boundary'
);

select is(
  has_function_privilege(
    'anon',
    'public.approve_supplier_send_content(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot approve supplier send content'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.approve_supplier_send_content(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  true,
  'authenticated managers can reach the role-checked content approval boundary'
);
select is(
  has_function_privilege(
    'service_role',
    'public.approve_supplier_send_content(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  false,
  'the service role cannot forge a user content approval'
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

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'ab111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'content-manager@mise.test',
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

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name
)
values (
  'ab000000-0000-4000-8000-000000000011',
  'ab000000-0000-4000-8000-000000000001',
  'Roma tomatoes', 'Produce', 'case', 1, 10, 3, 12, 'Envelope Produce'
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
)
values (
  'ab000000-0000-4000-8000-000000000201',
  'ab000000-0000-4000-8000-000000000001',
  'Envelope Produce', 'Temporary body', 'draft', current_date + 1
);

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, supplier_order_id
)
values (
  'ab000000-0000-4000-8000-000000000101',
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000011',
  'Roma tomatoes', 'Envelope Produce', 10, 'case',
  'Exact content approval fixture', 'high', 'approved',
  'ab000000-0000-4000-8000-000000000201'
);

update public.supplier_orders
set order_message = 'Order draft for Envelope Produce'
  || E'\n\nRoma tomatoes - 10 case'
  || E'\n\nDelivery requested: Tomorrow morning'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and id = 'ab000000-0000-4000-8000-000000000201';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'ready')::boolean,
  true,
  'the exact complete supplier email snapshot is ready for review'
);
select is(
  (public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'lineCount')::integer,
  1,
  'the preview binds the exact approved line set'
);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentVersion',
  'mise.supplier_send.v1',
  'the preview exposes the canonical supplier-send content version'
);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'from',
  'orders@envelope.test',
  'the preview exposes the exact server-resolved sender'
);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'to',
  'first@produce.test',
  'the preview exposes the exact server-resolved recipient'
);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'subject',
  'Envelope Kitchen order for Envelope Produce',
  'the preview exposes the exact server-generated subject'
);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'body',
  'Order draft for Envelope Produce'
    || E'\n\nRoma tomatoes - 10 case'
    || E'\n\nDelivery requested: Tomorrow morning',
  'the preview exposes the exact complete body instead of an envelope-only summary'
);
select ok(
  (public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint') ~ '^[a-f0-9]{64}$',
  'the ready snapshot includes a lowercase SHA-256 fingerprint'
);
select set_config(
  'mise_test.reviewed_content_fingerprint',
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint',
  true
);

select is(
  public.approve_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    (
      select id from public.mise_actions
      where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
        and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
    ),
    'ab000000-0000-4000-8000-000000000201',
    current_setting('mise_test.reviewed_content_fingerprint')
  )->>'outcome',
  'applied',
  'a manager can approve the exact full supplier-send snapshot'
);
reset role;

select is(
  (
    select expected_impact->'approvedSendContent'->>'fingerprint'
    from public.mise_actions
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
  ),
  current_setting('mise_test.reviewed_content_fingerprint'),
  'the action records the exact reviewed content fingerprint'
);
select is(
  (
    select expected_impact->'approvedSendContent' ? 'body'
    from public.mise_actions
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
  ),
  false,
  'the bounded approval attestation does not duplicate the email body'
);
select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and action = 'supplier_send_content_approved'
  ),
  1::bigint,
  'full-content approval leaves one tenant-scoped audit record'
);

update public.supplier_recipients
set email = 'changed@produce.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and lower(trim(supplier_name)) = 'envelope produce';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'to',
  'changed@produce.test',
  'the current preview reflects a changed supplier recipient'
);
select ok(
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
    is distinct from current_setting('mise_test.reviewed_content_fingerprint'),
  'a recipient change invalidates the previously reviewed fingerprint'
);
select is(
  public.approve_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    (
      select id from public.mise_actions
      where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
        and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
    ),
    'ab000000-0000-4000-8000-000000000201',
    current_setting('mise_test.reviewed_content_fingerprint')
  )->>'outcome',
  'send_content_changed',
  'stale reviewed content cannot be approved after the current snapshot changes'
);
reset role;

select is(
  (
    select expected_impact->'approvedSendContent'->>'to'
    from public.mise_actions
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'
  ),
  'first@produce.test',
  'a stale approval attempt does not overwrite the prior bounded attestation'
);
select is(
  (
    select count(*)
    from public.audit_logs
    where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
      and action = 'supplier_send_content_approved'
  ),
  1::bigint,
  'a stale approval attempt does not duplicate approval audit evidence'
);

select * from finish();
rollback;
