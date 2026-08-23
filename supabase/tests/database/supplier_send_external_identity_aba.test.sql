begin;

select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'ab111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'supplier-send-aba@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone)
values (
  'ab000000-0000-4000-8000-000000000001',
  'ABA Kitchen', 'Cafe', 'UTC'
);

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'ab000000-0000-4000-8000-000000000001',
  'ab111111-1111-4111-8111-111111111111',
  'manager', 'active'
);

insert into public.restaurant_email_connections (
  restaurant_id, provider, status, sender_email, last_verified_at
) values (
  'ab000000-0000-4000-8000-000000000001',
  'gmail', 'connected', 'orders@aba.test', clock_timestamp()
);

insert into public.supplier_recipients (restaurant_id, supplier_name, email)
values
  ('ab000000-0000-4000-8000-000000000001', 'Alpha Produce', 'alpha@aba.test'),
  ('ab000000-0000-4000-8000-000000000001', 'Beta Produce', 'beta@aba.test');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at,
  canonical_unit_verified_by
) values (
  'ab000000-0000-4000-8000-000000000011',
  'ab000000-0000-4000-8000-000000000001',
  'Tomatoes', 'Produce', 'case', 1, 8, 2, 10, 'Alpha Produce',
  'case', 1, 'verified', now(),
  'ab111111-1111-4111-8111-111111111111'
);

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
) values
  (
    'ab000000-0000-4000-8000-000000000201',
    'ab000000-0000-4000-8000-000000000001',
    'Alpha Produce', 'fixture pending render', 'draft', current_date + 1
  ),
  (
    'ab000000-0000-4000-8000-000000000202',
    'ab000000-0000-4000-8000-000000000001',
    'Beta Produce', 'unrelated draft', 'draft', current_date + 1
  );

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source,
  supplier_order_id
) values (
  'ab000000-0000-4000-8000-000000000101',
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000011',
  'Tomatoes', 'Alpha Produce', 2, 'case', 'ABA fixture', 'high',
  'approved', 'manual', 'ab000000-0000-4000-8000-000000000201'
);

update public.supplier_orders orders
set order_message = private.build_supplier_order_message(
  orders.restaurant_id, orders.id, orders.supplier_name, orders.operator_note
)
where orders.id = 'ab000000-0000-4000-8000-000000000201';

create temporary table send_aba_checkpoint (
  label text primary key,
  revision bigint not null,
  fingerprint text not null,
  from_header text not null,
  to_header text not null,
  subject_header text not null,
  beta_revision bigint not null
) on commit drop;
grant select on send_aba_checkpoint to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'initial exact content approval succeeds');
reset role;

insert into send_aba_checkpoint
select
  'initial', orders.send_content_revision,
  built.value->>'contentFingerprint',
  built.value->'content'->>'from',
  built.value->'content'->>'to',
  built.value->'content'->>'subject',
  (select send_content_revision from public.supplier_orders
   where id = 'ab000000-0000-4000-8000-000000000202')
from public.supplier_orders orders
cross join lateral (
  select private.build_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  ) as value
) built
where orders.id = 'ab000000-0000-4000-8000-000000000201';

-- Gmail sender/connection A -> B -> A.
update public.restaurant_email_connections
set status = 'needs_reauth', sender_email = null
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and provider = 'gmail';
update public.restaurant_email_connections
set status = 'connected', sender_email = 'orders@aba.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and provider = 'gmail';

select is(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->'content'->>'from', (select from_header from send_aba_checkpoint where label = 'initial'),
  'sender A -> B -> A restores the same visible From header');
select ok((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201') >
  (select revision from send_aba_checkpoint where label = 'initial'),
  'sender A -> B -> A advances the monotonic order content revision');
select isnt(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->>'contentFingerprint', (select fingerprint from send_aba_checkpoint where label = 'initial'),
  'sender A -> B -> A cannot restore the approved fingerprint');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  (select fingerprint from send_aba_checkpoint where label = 'initial')
)->>'outcome'), 'send_content_changed', 'sender ABA cannot reuse the old approval');
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'sender ABA requires and accepts a fresh review');
reset role;

insert into send_aba_checkpoint
select
  'sender', orders.send_content_revision,
  built.value->>'contentFingerprint',
  built.value->'content'->>'from',
  built.value->'content'->>'to',
  built.value->'content'->>'subject',
  (select send_content_revision from public.supplier_orders
   where id = 'ab000000-0000-4000-8000-000000000202')
from public.supplier_orders orders
cross join lateral (
  select private.build_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  ) as value
) built
where orders.id = 'ab000000-0000-4000-8000-000000000201';

-- Supplier recipient A -> B -> A; only the matching supplier draft advances.
update public.supplier_recipients
set email = 'temporary@aba.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and supplier_name = 'Alpha Produce';
update public.supplier_recipients
set email = 'alpha@aba.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and supplier_name = 'Alpha Produce';

select is(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->'content'->>'to', (select to_header from send_aba_checkpoint where label = 'sender'),
  'recipient A -> B -> A restores the same visible To header');
select ok((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201') >
  (select revision from send_aba_checkpoint where label = 'sender'),
  'recipient A -> B -> A advances the matching draft revision');
select isnt(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->>'contentFingerprint', (select fingerprint from send_aba_checkpoint where label = 'sender'),
  'recipient A -> B -> A cannot restore the approved fingerprint');
select is((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000202'),
  (select beta_revision from send_aba_checkpoint where label = 'sender'),
  'recipient invalidation does not advance an unrelated supplier draft');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  (select fingerprint from send_aba_checkpoint where label = 'sender')
)->>'outcome'), 'send_content_changed', 'recipient ABA cannot reuse the old approval');
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'recipient ABA requires and accepts a fresh review');
reset role;

insert into send_aba_checkpoint
select
  'recipient', orders.send_content_revision,
  built.value->>'contentFingerprint',
  built.value->'content'->>'from',
  built.value->'content'->>'to',
  built.value->'content'->>'subject',
  (select send_content_revision from public.supplier_orders
   where id = 'ab000000-0000-4000-8000-000000000202')
from public.supplier_orders orders
cross join lateral (
  select private.build_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  ) as value
) built
where orders.id = 'ab000000-0000-4000-8000-000000000201';

-- Restaurant name A -> B -> A restores Subject text but not authority.
update public.restaurants set name = 'Temporary ABA Kitchen'
where id = 'ab000000-0000-4000-8000-000000000001';
update public.restaurants set name = 'ABA Kitchen'
where id = 'ab000000-0000-4000-8000-000000000001';

select is(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->'content'->>'subject',
  (select subject_header from send_aba_checkpoint where label = 'recipient'),
  'restaurant-name A -> B -> A restores the same visible Subject');
select ok((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201') >
  (select revision from send_aba_checkpoint where label = 'recipient'),
  'restaurant-name A -> B -> A advances the draft revision');
select isnt(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->>'contentFingerprint', (select fingerprint from send_aba_checkpoint where label = 'recipient'),
  'restaurant-name A -> B -> A cannot restore the approved fingerprint');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  (select fingerprint from send_aba_checkpoint where label = 'recipient')
)->>'outcome'), 'send_content_changed', 'restaurant-name ABA cannot reuse the old approval');
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'restaurant-name ABA requires and accepts a fresh review');
reset role;

create temporary table nonmaterial_revision_before as
select send_content_revision as alpha_revision
from public.supplier_orders
where id = 'ab000000-0000-4000-8000-000000000201';

update public.restaurant_email_connections
set last_verified_at = clock_timestamp()
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and provider = 'gmail';
update public.supplier_recipients
set email = email
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and supplier_name = 'Alpha Produce';
update public.restaurants set cuisine_type = 'Bakery'
where id = 'ab000000-0000-4000-8000-000000000001';

select is((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201'),
  (select alpha_revision from nonmaterial_revision_before),
  'non-material connection, recipient, and restaurant updates do not churn send authority');

-- External identity A -> B -> A during an unresolved claim must preserve the
-- exact immutable claim for possible success, yet invalidate the old review if
-- Gmail definitively rejects and the draft becomes retryable.
create temporary table active_claim_aba_checkpoint as
select orders.send_content_revision as revision,
  built.value->>'contentFingerprint' as fingerprint,
  built.value->'content'->>'from' as from_header
from public.supplier_orders orders
cross join lateral (
  select private.build_supplier_send_content(
    'ab000000-0000-4000-8000-000000000001',
    'ab000000-0000-4000-8000-000000000201'
  ) as value
) built
where orders.id = 'ab000000-0000-4000-8000-000000000201';
grant select on active_claim_aba_checkpoint to authenticated;

insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id, content_version,
  content_fingerprint, authority_version, authority_fingerprint,
  approved_action_id, claimed_recommendation_ids, claimed_from,
  claimed_to, claimed_subject, credential_generation,
  claimed_content_revision, authority_evaluated_at
)
select
  orders.restaurant_id, orders.id,
  'ab111111-1111-4111-8111-111111111111', orders.id,
  'ab000000-0000-4000-8000-000000000901', 'sending',
  '<mise-003b-active-aba@mise.test>', 'mise.supplier_send.v1',
  action.expected_impact->'approvedSendContent'->>'fingerprint',
  'mise.purchase_authority.v1', repeat('a', 64), action.id,
  array['ab000000-0000-4000-8000-000000000101'::uuid],
  action.expected_impact->'approvedSendContent'->>'from',
  action.expected_impact->'approvedSendContent'->>'to',
  action.expected_impact->'approvedSendContent'->>'subject',
  1, orders.send_content_revision, clock_timestamp()
from public.supplier_orders orders
join public.mise_actions action
  on action.restaurant_id = orders.restaurant_id
 and action.idempotency_key = format('send_supplier_order:%s', orders.id)
where orders.id = 'ab000000-0000-4000-8000-000000000201';

update public.restaurant_email_connections
set sender_email = 'temporary-active@aba.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and provider = 'gmail';
update public.restaurant_email_connections
set sender_email = 'orders@aba.test'
where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
  and provider = 'gmail';

select is(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->'content'->>'from',
  (select from_header from active_claim_aba_checkpoint),
  'in-flight sender A -> B -> A restores the same visible From header');
select is((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201'),
  (select revision from active_claim_aba_checkpoint),
  'in-flight identity mutation does not perturb the immutable claimed revision');
select is((select external_identity_changed_during_claim
  from private.supplier_email_deliveries
  where supplier_order_id = 'ab000000-0000-4000-8000-000000000201'),
  true, 'in-flight identity mutation records bounded pending invalidation');

set local role service_role;
select is((public.service_fail_supplier_email_send(
  'ab111111-1111-4111-8111-111111111111',
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201',
  'ab000000-0000-4000-8000-000000000901',
  'rejected', 'active_identity_aba_fixture'
)->>'outcome'), 'failed',
  'definitive provider rejection consumes the pending identity invalidation');
reset role;

select ok((select send_content_revision from public.supplier_orders
  where id = 'ab000000-0000-4000-8000-000000000201') >
  (select revision from active_claim_aba_checkpoint),
  'definitive failure advances review authority after in-flight identity ABA');
select isnt(private.build_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  'ab000000-0000-4000-8000-000000000201'
)->>'contentFingerprint',
  (select fingerprint from active_claim_aba_checkpoint),
  'in-flight identity ABA cannot revive the pre-claim content fingerprint');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ab111111-1111-4111-8111-111111111111', true);
select is((public.approve_supplier_send_content(
  'ab000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'ab000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:ab000000-0000-4000-8000-000000000201'),
  'ab000000-0000-4000-8000-000000000201',
  (select fingerprint from active_claim_aba_checkpoint)
)->>'outcome'), 'send_content_changed',
  'retry cannot reuse content approval from before in-flight identity ABA');
reset role;

select * from finish();
rollback;
