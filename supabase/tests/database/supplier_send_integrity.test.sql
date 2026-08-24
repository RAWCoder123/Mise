begin;

select plan(84);

create or replace function pg_temp.try_execute(statement text)
returns boolean
language plpgsql
security invoker
as $$
begin
  execute statement;
  return true;
exception when others then
  return false;
end;
$$;

-- Stable tenant and actor used by the authenticated review boundary and by the
-- service-role claim/finalization boundary.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  'd3111111-1111-4111-8111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mise-003b-manager@mise.test',
  crypt('password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, now(), now()
);

insert into public.restaurants (id, name, cuisine_type, timezone)
values (
  'd3000000-0000-4000-8000-000000000001',
  'MISE-003B Kitchen', 'Cafe', 'UTC'
);

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values (
  'd3000000-0000-4000-8000-000000000001',
  'd3111111-1111-4111-8111-111111111111',
  'manager', 'active'
);

update public.system_operational_controls
set operational_mode = 'normal',
    ordering_policy = 'draft_only',
    order_drafting_enabled = true,
    gmail_delivery_enabled = true
where singleton;

update public.restaurant_operational_controls
set ordering_policy = 'draft_only',
    order_drafting_enabled = true,
    gmail_delivery_enabled = true
where restaurant_id = 'd3000000-0000-4000-8000-000000000001';

insert into public.restaurant_email_connections (
  restaurant_id, provider, status, sender_email, last_verified_at
) values (
  'd3000000-0000-4000-8000-000000000001',
  'gmail', 'connected', 'orders@mise-003b.test', clock_timestamp()
);

insert into public.supplier_recipients (restaurant_id, supplier_name, email)
values
  ('d3000000-0000-4000-8000-000000000001', 'Alpha Produce', 'alpha@supplier.test'),
  ('d3000000-0000-4000-8000-000000000001', 'Beta Produce', 'beta@supplier.test'),
  ('d3000000-0000-4000-8000-000000000001', 'Legacy Envelope', 'legacy@supplier.test');

insert into private.gmail_credentials (
  id, restaurant_id, provider_subject, sender_email,
  refresh_token_secret_id, granted_scopes, connected_by_user_id,
  credential_generation, last_refreshed_at
)
select
  'd3000000-0000-4000-8000-000000000090',
  'd3000000-0000-4000-8000-000000000001',
  'mise-003b-provider-subject', 'orders@mise-003b.test',
  vault.create_secret(
    'mise-003b-refresh-token-secret',
    'mise-003b-pgtap-' || gen_random_uuid()::text,
    'MISE-003B pgTAP credential fixture'
  ),
  array['https://www.googleapis.com/auth/gmail.send']::text[],
  'd3111111-1111-4111-8111-111111111111', 1, clock_timestamp();

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at,
  canonical_unit_verified_by
) values
  ('d3000000-0000-4000-8000-000000000011', 'd3000000-0000-4000-8000-000000000001', 'Zucchini', 'Produce', 'case', 1, 8, 2, 10, 'Alpha Produce', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000012', 'd3000000-0000-4000-8000-000000000001', 'Apples', 'Produce', 'case', 1, 8, 2, 10, 'Alpha Produce', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000013', 'd3000000-0000-4000-8000-000000000001', 'Broccoli', 'Produce', 'case', 1, 8, 2, 10, 'Beta Produce', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000014', 'd3000000-0000-4000-8000-000000000001', 'Carrots', 'Produce', 'case', 1, 8, 2, 10, 'Sending Supplier', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000015', 'd3000000-0000-4000-8000-000000000001', 'Dates', 'Produce', 'case', 1, 8, 2, 10, 'Unknown Supplier', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000016', 'd3000000-0000-4000-8000-000000000001', 'Eggplant', 'Produce', 'case', 1, 8, 2, 10, 'Failed Supplier', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000017', 'd3000000-0000-4000-8000-000000000001', 'Fennel', 'Produce', 'case', 1, 8, 2, 10, 'Unrelated Supplier', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000018', 'd3000000-0000-4000-8000-000000000001', 'Grapes', 'Produce', 'case', 1, 8, 2, 10, 'Legacy Envelope', 'case', 1, 'verified', now(), 'd3111111-1111-4111-8111-111111111111');

insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date,
  email_provider, provider_message_id, sent_at, sent_by_user_id
) values
  ('d3000000-0000-4000-8000-000000000201', 'd3000000-0000-4000-8000-000000000001', 'Alpha Produce', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000202', 'd3000000-0000-4000-8000-000000000001', 'Beta Produce', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000203', 'd3000000-0000-4000-8000-000000000001', 'Sending Supplier', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000204', 'd3000000-0000-4000-8000-000000000001', 'Unknown Supplier', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000205', 'd3000000-0000-4000-8000-000000000001', 'Failed Supplier', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000206', 'd3000000-0000-4000-8000-000000000001', 'Unrelated Supplier', 'fixture pending render', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000207', 'd3000000-0000-4000-8000-000000000001', 'Legacy Sent Supplier', 'legacy already sent', 'sent', current_date + 1, 'gmail', 'legacy-provider-message', now(), 'd3111111-1111-4111-8111-111111111111'),
  ('d3000000-0000-4000-8000-000000000208', 'd3000000-0000-4000-8000-000000000001', 'Legacy Unknown Supplier', 'legacy uncertain send', 'draft', current_date + 1, null, null, null, null),
  ('d3000000-0000-4000-8000-000000000209', 'd3000000-0000-4000-8000-000000000001', 'Legacy Envelope', 'fixture pending render', 'draft', current_date + 1, null, null, null, null);

-- Insert Alpha lines in reverse UUID order. The canonical preview must sort by
-- recommendation identity, independently of insertion or display-name order.
insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source,
  supplier_order_id
) values
  ('d3000000-0000-4000-8000-000000000102', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000012', 'Apples', 'Alpha Produce', 2, 'case', 'MISE-003B fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000201'),
  ('d3000000-0000-4000-8000-000000000101', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000011', 'Zucchini', 'Alpha Produce', 3, 'case', 'MISE-003B fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000201'),
  ('d3000000-0000-4000-8000-000000000103', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000013', 'Broccoli', 'Beta Produce', 2, 'case', 'Authority blocker fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000202'),
  ('d3000000-0000-4000-8000-000000000104', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000014', 'Carrots', 'Sending Supplier', 2, 'case', 'Freeze fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000203'),
  ('d3000000-0000-4000-8000-000000000105', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000015', 'Dates', 'Unknown Supplier', 2, 'case', 'Freeze fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000204'),
  ('d3000000-0000-4000-8000-000000000106', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000016', 'Eggplant', 'Failed Supplier', 2, 'case', 'Retry fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000205'),
  ('d3000000-0000-4000-8000-000000000107', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000017', 'Fennel', 'Unrelated Supplier', 2, 'case', 'Unrelated completion fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000206'),
  ('d3000000-0000-4000-8000-000000000108', 'd3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000018', 'Grapes', 'Legacy Envelope', 2, 'case', 'Legacy envelope fixture', 'high', 'approved', 'manual', 'd3000000-0000-4000-8000-000000000209');

update public.supplier_orders orders
set order_message = private.build_supplier_order_message(
  orders.restaurant_id, orders.id, orders.supplier_name, orders.operator_note
)
where orders.restaurant_id = 'd3000000-0000-4000-8000-000000000001'
  and orders.id in (
    'd3000000-0000-4000-8000-000000000201',
    'd3000000-0000-4000-8000-000000000202',
    'd3000000-0000-4000-8000-000000000203',
    'd3000000-0000-4000-8000-000000000204',
    'd3000000-0000-4000-8000-000000000205',
    'd3000000-0000-4000-8000-000000000206',
    'd3000000-0000-4000-8000-000000000209'
  );

-- Direct boundary privileges: clients review only through the public content
-- RPCs; only service_role can call provider wrappers, and even service_role
-- cannot mutate durable order/line rows directly.
select is(has_function_privilege('authenticated', 'public.preview_supplier_send_content(uuid,uuid)', 'EXECUTE'), true,
  'authenticated users can reach the membership-checked send preview');
select is(has_function_privilege('anon', 'public.preview_supplier_send_content(uuid,uuid)', 'EXECUTE'), false,
  'anonymous users cannot preview supplier send content');
select is(has_function_privilege('authenticated', 'public.approve_supplier_send_content(uuid,uuid,uuid,text)', 'EXECUTE'), true,
  'authenticated users can reach the manager-checked content approval');
select is(has_function_privilege('service_role', 'public.approve_supplier_send_content(uuid,uuid,uuid,text)', 'EXECUTE'), false,
  'service role cannot forge operator content approval');
select is(has_function_privilege('service_role', 'public.service_claim_supplier_email_send(uuid,uuid,uuid,uuid,text)', 'EXECUTE'), true,
  'service role can call the guarded provider claim wrapper');
select is(has_function_privilege('authenticated', 'public.service_claim_supplier_email_send(uuid,uuid,uuid,uuid,text)', 'EXECUTE'), false,
  'authenticated clients cannot call the provider claim wrapper');
select is(has_function_privilege('service_role', 'private.service_claim_supplier_email_send_unchecked(uuid,uuid,uuid,uuid,text)', 'EXECUTE'), false,
  'service role cannot invoke the retired unchecked claim path');
select is(has_function_privilege('authenticated', 'public.approve_supplier_send_envelope(uuid,uuid,uuid,text,text,text)', 'EXECUTE'), false,
  'the old envelope-only approval RPC is retired');
select is(has_table_privilege('service_role', 'public.supplier_orders', 'UPDATE'), false,
  'service role has no direct supplier order update privilege');
select is(has_table_privilege('service_role', 'public.purchase_recommendations', 'UPDATE'), false,
  'service role has no direct recommendation update privilege');
select is(has_table_privilege('service_role', 'public.mise_actions', 'UPDATE'), false,
  'service role cannot forge operator content approval through direct action updates');
select is(has_table_privilege('authenticated', 'private.supplier_email_deliveries', 'SELECT'), false,
  'authenticated clients cannot read private delivery proof');
select is(has_table_privilege('service_role', 'private.supplier_email_deliveries', 'SELECT'), false,
  'service role has no direct private delivery table access');

set local role service_role;
select is(pg_temp.try_execute($sql$
  update public.supplier_orders
  set operator_note = 'forged service-role edit'
  where id = 'd3000000-0000-4000-8000-000000000201'
$sql$), false, 'service role direct order mutation is denied in practice');
select is(pg_temp.try_execute($sql$
  update public.purchase_recommendations
  set recommended_quantity = 999
  where id = 'd3000000-0000-4000-8000-000000000101'
$sql$), false, 'service role direct line mutation is denied in practice');
select is(pg_temp.try_execute($sql$
  update public.mise_actions
  set status = 'approved',
      expected_impact = jsonb_build_object('approvedSendContent', jsonb_build_object(
        'version', 'mise.supplier_send.v1', 'fingerprint', repeat('0', 64)
      ))
  where idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'
$sql$), false, 'service role cannot forge a full-content approval in practice');
reset role;

-- The helper hashes the exact version domain and deterministic PostgreSQL
-- JSONB representation. This hard-coded vector protects serialization drift.
select is(
  private.supplier_send_sha256('mise.supplier_send.v1', '{"b":2,"a":1}'::jsonb),
  '5693a7f673c2aaf255a6e9edd5248f800ac8ab5912c9eff51f8bbbcc9c641fdc',
  'supplier send SHA-256 matches the canonical JSONB test vector'
);
select is(
  private.supplier_send_sha256('mise.supplier_send.v1', '{"b":2,"a":1}'::jsonb),
  private.supplier_send_sha256('mise.supplier_send.v1', '{"a":1,"b":2}'::jsonb),
  'JSON object key insertion order cannot change the fingerprint'
);
select isnt(
  private.supplier_send_sha256('mise.supplier_send.v1', '{"a":1,"b":2}'::jsonb),
  private.supplier_send_sha256('mise.supplier_send.v2', '{"a":1,"b":2}'::jsonb),
  'content version domain-separates otherwise identical material'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok((public.preview_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201'
)->>'ready')::boolean, 'canonical Alpha preview is ready');
select is((public.preview_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201'
)->>'lineCount')::integer, 2, 'preview binds the complete approved line count');
select is(public.preview_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201'
)->'lines'->0->>'recommendationId', 'd3000000-0000-4000-8000-000000000101',
  'canonical lines sort by recommendation UUID, not insertion order');
select is(public.preview_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201'
)->'lines'->1->>'recommendationId', 'd3000000-0000-4000-8000-000000000102',
  'canonical line ordering is complete and stable');
select is(
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint',
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint',
  'unchanged previews produce the same fingerprint'
);
select ok(
  not (public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  ) ? 'refreshToken'),
  'preview never returns a refresh credential field'
);
select ok(
  position('mise-003b-refresh-token-secret' in public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )::text) = 0,
  'preview contains no Vault credential material'
);

select is((public.approve_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'd3000000-0000-4000-8000-000000000201', repeat('0', 64)
)->>'outcome'), 'send_content_changed',
  'approval rejects a reviewed fingerprint that does not match current content');
select is((select status from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'waiting_for_approval', 'hash mismatch leaves the action unapproved');

select is((public.approve_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'd3000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'manager approves the exact full canonical content');
select is((select expected_impact->'approvedSendContent'->>'fingerprint'
  from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint', 'approval stores the exact reviewed content hash');
select is((public.approve_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'd3000000-0000-4000-8000-000000000201',
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000201'
  )->>'contentFingerprint'
)->>'outcome'), 'already_applied', 'exact content approval replay is idempotent');
reset role;

select is((select count(*) from public.audit_logs
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and entity_id = (select id from public.mise_actions
      where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
        and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201')
    and action = 'supplier_send_content_approved'), 1::bigint,
  'exact approval replay creates no duplicate approval audit');

-- A legacy action carrying only approvedEnvelope must never authorize claim.
update public.mise_actions
set status = 'approved',
    approved_by = 'd3111111-1111-4111-8111-111111111111',
    expected_impact = coalesce(expected_impact, '{}'::jsonb) || jsonb_build_object(
      'approvedEnvelope', jsonb_build_object(
        'from', 'orders@mise-003b.test',
        'to', 'legacy@supplier.test',
        'subject', 'MISE-003B Kitchen order for Legacy Envelope'
      )
    )
where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
  and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000209';

set local role service_role;
select is((public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000209',
  'd3000000-0000-4000-8000-000000000209',
  '<mise-003b-legacy-envelope@mise.test>'
)->>'outcome'), 'send_content_unapproved',
  'old envelope-only action material cannot authorize a provider claim');
select ok(not (public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000209',
  'd3000000-0000-4000-8000-000000000209',
  '<mise-003b-legacy-envelope@mise.test>'
) ? 'refreshToken'), 'legacy approval blocker returns no credential');
reset role;
select is((select count(*) from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000209'), 0::bigint,
  'legacy envelope denial creates no delivery claim');

-- Approve Beta's exact content, but deliberately leave its purchase authority
-- unattested. This is a real checked claim and must fail before any token or
-- private delivery row is created.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3111111-1111-4111-8111-111111111111', true);
select is((public.approve_supplier_send_content(
  'd3000000-0000-4000-8000-000000000001',
  (select id from public.mise_actions
   where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000202'),
  'd3000000-0000-4000-8000-000000000202',
  public.preview_supplier_send_content(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000202'
  )->>'contentFingerprint'
)->>'outcome'), 'applied', 'Beta full-content approval succeeds before authority claim');
reset role;

set local role service_role;
select is((public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000202',
  'd3000000-0000-4000-8000-000000000202',
  '<mise-003b-authority-block@mise.test>'
)->>'outcome'), 'draft_authority_incomplete',
  'real provider claim blocks unattested MISE-003A purchase authority');
select ok(public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000202',
  'd3000000-0000-4000-8000-000000000202',
  '<mise-003b-authority-block@mise.test>'
)->'blockerCodes' ? 'draft_authority_incomplete',
  'authority blocker exposes only a bounded deterministic blocker code');
select ok(not (public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000202',
  'd3000000-0000-4000-8000-000000000202',
  '<mise-003b-authority-block@mise.test>'
) ? 'refreshToken'), 'authority blocker returns no refresh token');
reset role;
select is((select count(*) from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000202'), 0::bigint,
  'authority-blocked claim creates no delivery row');
select is((select count(*) from public.audit_logs
  where entity_id = 'd3000000-0000-4000-8000-000000000202'
    and action = 'supplier_email_claimed'), 0::bigint,
  'authority-blocked claim creates no claimed audit');

-- Proof metadata is an all-or-none private record. Partial rows must fail the
-- table constraint before they can look like a current claim.
select is(pg_temp.try_execute($sql$
  insert into private.supplier_email_deliveries (
    restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
    claim_token, status, rfc_message_id, content_version
  ) values (
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000206',
    'd3111111-1111-4111-8111-111111111111',
    'd3000000-0000-4000-8000-000000000206',
    'd3000000-0000-4000-8000-000000000906',
    'sending', '<mise-003b-partial@mise.test>', 'mise.supplier_send.v1'
  )
$sql$), false, 'partial private send-proof metadata is rejected');
select is((select count(*) from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000206'), 0::bigint,
  'rejected partial metadata leaves no private claim row');

insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id, last_error_code,
  provider_message_id, provider_accepted_at
) values
  ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000203', 'd3111111-1111-4111-8111-111111111111', 'd3000000-0000-4000-8000-000000000203', 'd3000000-0000-4000-8000-000000000903', 'sending', '<mise-003b-sending@mise.test>', null, null, null),
  ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000204', 'd3111111-1111-4111-8111-111111111111', 'd3000000-0000-4000-8000-000000000204', 'd3000000-0000-4000-8000-000000000904', 'unknown', '<mise-003b-unknown@mise.test>', 'legacy_unproven_claim', null, null),
  ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000205', 'd3111111-1111-4111-8111-111111111111', 'd3000000-0000-4000-8000-000000000205', 'd3000000-0000-4000-8000-000000000905', 'failed', '<mise-003b-failed@mise.test>', 'provider_rejected', null, null),
  ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000207', 'd3111111-1111-4111-8111-111111111111', 'd3000000-0000-4000-8000-000000000207', 'd3000000-0000-4000-8000-000000000907', 'sent', '<mise-003b-legacy-sent@mise.test>', null, 'legacy-provider-message', now()),
  ('d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000208', 'd3111111-1111-4111-8111-111111111111', 'd3000000-0000-4000-8000-000000000208', 'd3000000-0000-4000-8000-000000000908', 'unknown', '<mise-003b-legacy-unknown@mise.test>', 'legacy_unproven_claim', null, null);

select is(pg_temp.try_execute($sql$
  update public.supplier_orders set operator_note = 'mutated while sending'
  where id = 'd3000000-0000-4000-8000-000000000203'
$sql$), false, 'sending freezes material supplier-order content');
select is(pg_temp.try_execute($sql$
  update public.purchase_recommendations set recommended_quantity = 9
  where id = 'd3000000-0000-4000-8000-000000000104'
$sql$), false, 'sending freezes its attached recommendation line');
select is(pg_temp.try_execute($sql$
  update public.supplier_orders set delivery_date = current_date + 9
  where id = 'd3000000-0000-4000-8000-000000000204'
$sql$), false, 'unknown delivery freezes material supplier-order content');
select is(pg_temp.try_execute($sql$
  update public.purchase_recommendations set unit = 'box'
  where id = 'd3000000-0000-4000-8000-000000000105'
$sql$), false, 'unknown delivery freezes its attached recommendation line');

create temporary table failed_revision_before (revision bigint) on commit drop;
insert into failed_revision_before
select send_content_revision from public.supplier_orders
where id = 'd3000000-0000-4000-8000-000000000205';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3111111-1111-4111-8111-111111111111', true);
select lives_ok($sql$
  select public.update_supplier_order_draft(
    'd3000000-0000-4000-8000-000000000001',
    'd3000000-0000-4000-8000-000000000205',
    'edit after definitive rejection', true, current_date + 3, true
  )
$sql$, 'definitively failed delivery permits a fresh draft edit');
reset role;
select lives_ok($sql$
  update public.purchase_recommendations set recommended_quantity = 4
  where id = 'd3000000-0000-4000-8000-000000000106'
$sql$, 'definitively failed delivery permits a line edit');
select ok((select send_content_revision from public.supplier_orders
  where id = 'd3000000-0000-4000-8000-000000000205') >
  (select revision from failed_revision_before),
  'failed-order edits advance the monotonic content revision');
select is((select operator_note from public.supplier_orders
  where id = 'd3000000-0000-4000-8000-000000000205'),
  'edit after definitive rejection', 'failed-order edit persists through the guarded RPC');

-- Controlled current proof for Alpha: the action was genuinely full-content
-- approved above, while authority metadata is private and durable. Completion
-- must finalize exactly the sorted claimed A+B set and no other recommendation.
insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id,
  content_version, content_fingerprint, authority_version,
  authority_fingerprint, approved_action_id, claimed_recommendation_ids,
  claimed_from, claimed_to, claimed_subject, credential_generation,
  claimed_content_revision, authority_evaluated_at
)
select
  orders.restaurant_id, orders.id,
  'd3111111-1111-4111-8111-111111111111', orders.id,
  'd3000000-0000-4000-8000-000000000901', 'sending',
  '<mise-003b-alpha@mise.test>',
  'mise.supplier_send.v1',
  action.expected_impact->'approvedSendContent'->>'fingerprint',
  'mise.purchase_authority.v1', repeat('a', 64), action.id,
  array[
    'd3000000-0000-4000-8000-000000000101'::uuid,
    'd3000000-0000-4000-8000-000000000102'::uuid
  ],
  action.expected_impact->'approvedSendContent'->>'from',
  action.expected_impact->'approvedSendContent'->>'to',
  action.expected_impact->'approvedSendContent'->>'subject',
  1, orders.send_content_revision, clock_timestamp()
from public.supplier_orders orders
join public.mise_actions action
  on action.restaurant_id = orders.restaurant_id
 and action.idempotency_key = format('send_supplier_order:%s', orders.id)
where orders.id = 'd3000000-0000-4000-8000-000000000201';

select ok((select content_fingerprint ~ '^[a-f0-9]{64}$'
  and authority_fingerprint ~ '^[a-f0-9]{64}$'
  and cardinality(claimed_recommendation_ids) = 2
  from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000201'),
  'current private claim persists complete bounded metadata');

-- Claim is the irreversible provider boundary. Once it exists, neither the
-- ordinary manager decision RPC nor a privileged direct status mutation may
-- reject/cancel the approved action while the provider is in flight.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3111111-1111-4111-8111-111111111111', true);
select throws_ok($sql$
  select public.decide_mise_action(
    'd3000000-0000-4000-8000-000000000001',
    (select id from public.mise_actions
     where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
       and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
    'rejected'
  )
$sql$, '55000', 'send_in_progress',
  'manager rejection cannot revoke an in-flight claimed send');
reset role;
select throws_ok($sql$
  update public.mise_actions
  set status = 'cancelled'
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'
$sql$, '55000', 'send_in_progress',
  'direct cancellation cannot revoke an in-flight claimed send');
select is((select status from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'approved', 'blocked in-flight revocation leaves the claimed action approved');

-- An uncertain provider result is still irrevocable. Only the service-owned
-- transition to unverified is permitted until an explicit resolution exists.
update private.supplier_email_deliveries
set status = 'unknown', last_error_code = 'supplier_email_outcome_unknown'
where supplier_order_id = 'd3000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd3111111-1111-4111-8111-111111111111', true);
select throws_ok($sql$
  select public.decide_mise_action(
    'd3000000-0000-4000-8000-000000000001',
    (select id from public.mise_actions
     where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
       and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
    'rejected'
  )
$sql$, '55000', 'delivery_requires_review',
  'manager rejection cannot resolve an unknown claimed delivery');
reset role;
select throws_ok($sql$
  update public.mise_actions
  set status = 'cancelled'
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'
$sql$, '55000', 'delivery_requires_review',
  'direct cancellation cannot resolve an unknown claimed delivery');
select is((select status from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'approved', 'blocked unknown-delivery revocation preserves the claimed action');
update private.supplier_email_deliveries
set status = 'sending', last_error_code = null
where supplier_order_id = 'd3000000-0000-4000-8000-000000000201';

set local role service_role;
select is((public.service_fail_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201',
  'd3000000-0000-4000-8000-000000000901',
  'unknown', 'supplier_email_outcome_unknown'
)->>'outcome'), 'unknown',
  'provider-owned unknown transition remains valid after action guarding');
reset role;
select is((select status from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'unverified', 'provider-owned unknown transition marks the action unverified');

-- Restore this controlled fixture through a non-active delivery state so the
-- later success-path assertions can exercise completion independently.
update private.supplier_email_deliveries
set status = 'failed'
where supplier_order_id = 'd3000000-0000-4000-8000-000000000201';
update public.mise_actions
set status = 'approved', error_code = null, error_message = null
where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
  and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201';
update private.supplier_email_deliveries
set status = 'sending', last_error_code = null
where supplier_order_id = 'd3000000-0000-4000-8000-000000000201';

-- A second controlled claim proves completion cannot verify a Gmail
-- connection that was relinked to different credential identity/generation
-- while the provider request was in flight.
insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id,
  content_version, content_fingerprint, authority_version,
  authority_fingerprint, approved_action_id, claimed_recommendation_ids,
  claimed_from, claimed_to, claimed_subject, credential_generation,
  claimed_content_revision, authority_evaluated_at
)
select
  orders.restaurant_id, orders.id,
  'd3111111-1111-4111-8111-111111111111', orders.id,
  'd3000000-0000-4000-8000-000000000902', 'sending',
  '<mise-003b-beta@mise.test>',
  'mise.supplier_send.v1',
  action.expected_impact->'approvedSendContent'->>'fingerprint',
  'mise.purchase_authority.v1', repeat('b', 64), action.id,
  array['d3000000-0000-4000-8000-000000000103'::uuid],
  action.expected_impact->'approvedSendContent'->>'from',
  action.expected_impact->'approvedSendContent'->>'to',
  action.expected_impact->'approvedSendContent'->>'subject',
  1, orders.send_content_revision, clock_timestamp()
from public.supplier_orders orders
join public.mise_actions action
  on action.restaurant_id = orders.restaurant_id
 and action.idempotency_key = format('send_supplier_order:%s', orders.id)
where orders.id = 'd3000000-0000-4000-8000-000000000202';

update private.gmail_credentials
set provider_subject = 'mise-003b-relinked-subject',
  sender_email = 'relinked@mise-003b.test',
  credential_generation = 2,
  updated_at = clock_timestamp()
where id = 'd3000000-0000-4000-8000-000000000090';
update public.restaurant_email_connections
set status = 'connected',
  sender_email = 'relinked@mise-003b.test',
  last_verified_at = '2001-01-01 00:00:00+00'::timestamptz
where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
  and provider = 'gmail';

set local role service_role;
select is((public.service_complete_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000202',
  'd3000000-0000-4000-8000-000000000902',
  'mise-003b-provider-beta'
)->>'outcome'), 'applied',
  'accepted claimed send still completes after Gmail is relinked');
select is((public.service_complete_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000202',
  'd3000000-0000-4000-8000-000000000902',
  'mise-003b-provider-beta'
)->>'externalIdentityChangedDuringClaim'), 'true',
  'successful completion reports that external identity changed after claim');
reset role;
select ok((select connection.status = 'connected'
    and connection.sender_email = 'relinked@mise-003b.test'
    and connection.last_verified_at = '2001-01-01 00:00:00+00'::timestamptz
    and credential.provider_subject = 'mise-003b-relinked-subject'
    and credential.credential_generation = 2
  from public.restaurant_email_connections connection
  join private.gmail_credentials credential
    on credential.restaurant_id = connection.restaurant_id
  where connection.restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and connection.provider = 'gmail'),
  'completion does not verify or alter the relinked Gmail relationship');

-- Likewise, disconnecting after Alpha claim cannot be undone by completion.
update public.restaurant_email_connections
set status = 'needs_reauth', last_verified_at = null
where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
  and provider = 'gmail';

set local role service_role;
select is((public.service_complete_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201',
  'd3000000-0000-4000-8000-000000000901',
  'mise-003b-provider-alpha'
)->>'outcome'), 'applied', 'completion atomically applies the exact claimed send');
reset role;

select ok((select status = 'needs_reauth' and last_verified_at is null
  from public.restaurant_email_connections
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and provider = 'gmail'),
  'completion does not resurrect or verify a disconnected Gmail relationship');
select is((select status from public.mise_actions
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and idempotency_key = 'send_supplier_order:d3000000-0000-4000-8000-000000000201'),
  'executed', 'valid completion advances the still-approved claimed action to executed');

select is((select count(*) from public.purchase_recommendations
  where id in (
    'd3000000-0000-4000-8000-000000000101',
    'd3000000-0000-4000-8000-000000000102'
  ) and status = 'ordered'), 2::bigint,
  'completion marks every and only claimed Alpha line ordered');
select is((select status from public.purchase_recommendations
  where id = 'd3000000-0000-4000-8000-000000000107'), 'approved',
  'completion leaves unrelated recommendation C untouched');
select is((select status || ':' || email_provider || ':' || provider_message_id
  from public.supplier_orders
  where id = 'd3000000-0000-4000-8000-000000000201'),
  'sent:gmail:mise-003b-provider-alpha',
  'completion durably binds the order to Gmail provider acceptance');

set local role service_role;
select is((public.service_complete_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201',
  'd3000000-0000-4000-8000-000000000901',
  'mise-003b-provider-alpha'
)->>'outcome'), 'already_applied', 'exact completion replay is idempotent');
select is((public.service_complete_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000201',
  'd3000000-0000-4000-8000-000000000901',
  'mise-003b-provider-alpha'
)->>'externalIdentityChangedDuringClaim'), 'true',
  'completion replay preserves the claimed-recipient change disclosure');
reset role;

select is((select count(*) from public.audit_logs
  where restaurant_id = 'd3000000-0000-4000-8000-000000000001'
    and entity_id = 'd3000000-0000-4000-8000-000000000201'
    and action = 'supplier_order_sent'), 1::bigint,
  'completion replay creates no duplicate sent audit');
select is((select count(*) from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000201'), 1::bigint,
  'completion replay creates no duplicate delivery row');

-- Legacy terminal success remains replay-safe even without MISE-003B metadata.
set local role service_role;
select is((public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000207',
  'd3000000-0000-4000-8000-000000000207',
  '<mise-003b-legacy-sent@mise.test>'
)->>'outcome'), 'already_sent', 'legacy sent delivery replays as already sent');
select is((public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000207',
  'd3000000-0000-4000-8000-000000000207',
  '<mise-003b-legacy-sent@mise.test>'
)->>'providerMessageId'), 'legacy-provider-message',
  'legacy sent replay preserves its provider message id');
select ok(not (public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000207',
  'd3000000-0000-4000-8000-000000000207',
  '<mise-003b-legacy-sent@mise.test>'
) ? 'refreshToken'), 'legacy sent replay does not disclose credentials');

select is((public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000208',
  'd3000000-0000-4000-8000-000000000208',
  '<mise-003b-legacy-unknown@mise.test>'
)->>'outcome'), 'requires_review', 'legacy unknown delivery never retries automatically');
select ok(not (public.service_claim_supplier_email_send(
  'd3111111-1111-4111-8111-111111111111',
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000208',
  'd3000000-0000-4000-8000-000000000208',
  '<mise-003b-legacy-unknown@mise.test>'
) ? 'refreshToken'), 'legacy unknown outcome returns no credential');
reset role;

select is((select attempt_count from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000208'), 1,
  'legacy unknown observation does not increment retry attempts');
select is((select claim_token from private.supplier_email_deliveries
  where supplier_order_id = 'd3000000-0000-4000-8000-000000000208'),
  'd3000000-0000-4000-8000-000000000908'::uuid,
  'legacy unknown observation does not mint a new claim token');

-- Durable proof blocks order-only deletion without breaking the existing
-- restaurant-owned cascade across orders, actions, and private delivery rows.
insert into public.restaurants (id, name, cuisine_type, timezone)
values ('d3ffffff-0000-4000-8000-000000000001', 'Cascade Kitchen', 'Cafe', 'UTC');
insert into public.supplier_orders (
  id, restaurant_id, supplier_name, order_message, status, delivery_date
) values (
  'd3ffffff-0000-4000-8000-000000000201',
  'd3ffffff-0000-4000-8000-000000000001',
  'Cascade Supplier', 'Cascade proof body', 'draft', current_date + 1
);
insert into private.supplier_email_deliveries (
  restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
  claim_token, status, rfc_message_id, last_error_code,
  content_version, content_fingerprint, authority_version,
  authority_fingerprint, approved_action_id, claimed_recommendation_ids,
  claimed_from, claimed_to, claimed_subject, credential_generation,
  claimed_content_revision, authority_evaluated_at
) values (
  'd3ffffff-0000-4000-8000-000000000001',
  'd3ffffff-0000-4000-8000-000000000201',
  'd3111111-1111-4111-8111-111111111111',
  'd3ffffff-0000-4000-8000-000000000201',
  'd3ffffff-0000-4000-8000-000000000901',
  'failed', '<mise-003b-cascade@mise.test>', 'fixture_rejected',
  'mise.supplier_send.v1', repeat('a', 64),
  'mise.purchase_authority.v1', repeat('b', 64),
  (select id from public.mise_actions
   where restaurant_id = 'd3ffffff-0000-4000-8000-000000000001'
     and idempotency_key = 'send_supplier_order:d3ffffff-0000-4000-8000-000000000201'),
  array['d3ffffff-0000-4000-8000-000000000101'::uuid],
  'orders@cascade.test', 'supplier@cascade.test',
  'Cascade Kitchen order for Cascade Supplier', 1, 1, clock_timestamp()
);
select lives_ok(
  $sql$delete from public.restaurants
    where id = 'd3ffffff-0000-4000-8000-000000000001'$sql$,
  'restaurant deletion preserves the existing tenant-owned cascade'
);
select is((select count(*) from public.supplier_orders
  where id = 'd3ffffff-0000-4000-8000-000000000201'), 0::bigint,
  'tenant cascade removes its supplier order');
select is((select count(*) from public.mise_actions
  where restaurant_id = 'd3ffffff-0000-4000-8000-000000000001'), 0::bigint,
  'tenant cascade removes its send action');
select is((select count(*) from private.supplier_email_deliveries
  where supplier_order_id = 'd3ffffff-0000-4000-8000-000000000201'), 0::bigint,
  'tenant cascade removes its private delivery proof');

select * from finish();
rollback;
