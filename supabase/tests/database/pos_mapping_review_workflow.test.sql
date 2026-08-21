begin;

select plan(45);

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
    '2b111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mapping-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '2b222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mapping-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '2b333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'mapping-owner-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type)
values
  ('2ba00000-0000-4000-8000-000000000001', 'Mapping Kitchen A', 'Fast casual'),
  ('2bb00000-0000-4000-8000-000000000001', 'Mapping Kitchen B', 'Cafe');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('2ba00000-0000-4000-8000-000000000001', '2b111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('2ba00000-0000-4000-8000-000000000001', '2b222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('2bb00000-0000-4000-8000-000000000001', '2b333333-3333-4333-8333-333333333333', 'owner', 'active');

insert into public.pos_integrations (id, restaurant_id, provider, status)
values
  ('2ba00000-0000-4000-8000-000000000101', '2ba00000-0000-4000-8000-000000000001', 'square', 'connected'),
  ('2bb00000-0000-4000-8000-000000000101', '2bb00000-0000-4000-8000-000000000001', 'square', 'connected');

insert into public.pos_locations (
  id, restaurant_id, pos_integration_id, external_location_id,
  display_name, timezone, status
)
values
  (
    '2ba00000-0000-4000-8000-000000000201',
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000101',
    'square-loc-a', 'Downtown', 'America/New_York', 'active'
  ),
  (
    '2bb00000-0000-4000-8000-000000000201',
    '2bb00000-0000-4000-8000-000000000001',
    '2bb00000-0000-4000-8000-000000000101',
    'square-loc-b', 'Uptown', 'America/New_York', 'active'
  );

insert into public.menu_items (id, restaurant_id, name, category, active)
values
  ('2ba00000-0000-4000-8000-000000000301', '2ba00000-0000-4000-8000-000000000001', 'Suggested Burger', 'Entree', true),
  ('2ba00000-0000-4000-8000-000000000302', '2ba00000-0000-4000-8000-000000000001', 'Operator Burger', 'Entree', true),
  ('2ba00000-0000-4000-8000-000000000303', '2ba00000-0000-4000-8000-000000000001', 'Inactive Burger', 'Entree', false),
  ('2bb00000-0000-4000-8000-000000000301', '2bb00000-0000-4000-8000-000000000001', 'Foreign Burger', 'Entree', true);

insert into public.pos_catalog_item_mappings (
  id, restaurant_id, pos_location_id, external_catalog_item_id,
  external_variation_id, external_name, menu_item_id,
  verification_status, confidence, effective_from
)
values
  (
    '2ba00000-0000-4000-8000-000000000401',
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000201',
    'ITEM-VERIFY', 'VAR-VERIFY', 'Square Burger',
    '2ba00000-0000-4000-8000-000000000301', 'draft', 0.7, now() - interval '1 day'
  ),
  (
    '2ba00000-0000-4000-8000-000000000402',
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000201',
    'ITEM-REJECT', 'VAR-REJECT', 'Square Side',
    '2ba00000-0000-4000-8000-000000000301', 'draft', 0.6, now() - interval '1 day'
  ),
  (
    '2ba00000-0000-4000-8000-000000000403',
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000201',
    'ITEM-VERIFY', 'VAR-VERIFY', 'Duplicate Square Burger',
    '2ba00000-0000-4000-8000-000000000301', 'draft', 0.5, now() - interval '2 days'
  ),
  (
    '2bb00000-0000-4000-8000-000000000401',
    '2bb00000-0000-4000-8000-000000000001',
    '2bb00000-0000-4000-8000-000000000201',
    'ITEM-FOREIGN', 'VAR-FOREIGN', 'Foreign Square Burger',
    '2bb00000-0000-4000-8000-000000000301', 'draft', 0.9, now() - interval '1 day'
  );

select is(
  has_table_privilege('authenticated', 'public.pos_catalog_item_mappings', 'UPDATE'),
  false,
  'authenticated clients cannot update POS mappings directly'
);
select is(
  has_function_privilege('authenticated', 'public.list_pos_catalog_mapping_reviews(uuid)', 'EXECUTE'),
  true,
  'authenticated clients can execute the guarded review-list RPC'
);
select is(
  has_function_privilege('authenticated', 'public.review_pos_catalog_mapping(uuid,uuid,uuid,text)', 'EXECUTE'),
  true,
  'authenticated clients can execute the guarded review-decision RPC'
);
select is(
  has_function_privilege('service_role', 'public.review_pos_catalog_mapping(uuid,uuid,uuid,text)', 'EXECUTE'),
  false,
  'service workflows cannot impersonate the explicit operator review RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($sql$select public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')$sql$),
  false,
  'staff cannot list the mapping review queue'
);
select is(
  pg_temp.try_execute($sql$select public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000401',
    '2ba00000-0000-4000-8000-000000000302',
    'verify'
  )$sql$),
  false,
  'staff cannot verify a POS mapping'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->'mappings'),
  3,
  'manager sees all three current same-tenant draft rows before an identity is verified'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  3,
  'review queue reports the truthful total number of current reviewable drafts'
);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->'menuItems'),
  2,
  'menu choices include only active same-tenant items'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->'mappings'->0 ? 'providerLocationId'),
  true,
  'review rows identify their Square location without raw provider payloads'
);
select is(
  pg_temp.try_execute($sql$select public.review_pos_catalog_mapping(
    '2bb00000-0000-4000-8000-000000000001',
    '2bb00000-0000-4000-8000-000000000401',
    '2bb00000-0000-4000-8000-000000000301',
    'verify'
  )$sql$),
  false,
  'a manager cannot review another restaurant mapping'
);
select is(
  pg_temp.try_execute($sql$select public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000401',
    '2bb00000-0000-4000-8000-000000000301',
    'verify'
  )$sql$),
  false,
  'a mapping cannot be verified to another restaurant menu item'
);
reset role;

select is(
  (select verification_status from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000401'),
  'draft',
  'failed cross-tenant attempts leave the suggestion non-authoritative'
);
select is(
  jsonb_array_length(public.service_fetch_operational_planning_snapshot(
    '2b111111-1111-4111-8111-111111111111',
    '2ba00000-0000-4000-8000-000000000001'
  )->'providerMappings'),
  0,
  'draft suggestions do not enter operational planning'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000401',
    '2ba00000-0000-4000-8000-000000000302',
    'verify'
  )->>'outcome',
  'verified',
  'manager explicitly verifies the mapping with an operator override'
);
reset role;

select is(
  (select menu_item_id from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000401'),
  '2ba00000-0000-4000-8000-000000000302'::uuid,
  'verification persists the selected active menu item instead of the suggestion'
);
select is(
  (select verification_status from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000401'),
  'verified',
  'explicit review is the verified authority transition'
);
select is(
  (select verified_by from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000401'),
  '2b111111-1111-4111-8111-111111111111'::uuid,
  'verification records the manager actor'
);
select ok(
  (select verified_at is not null from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000401'),
  'verification records its server time'
);
select is(
  (select count(*) from public.audit_logs where entity_id = '2ba00000-0000-4000-8000-000000000401' and action = 'pos_mapping_verified'),
  1::bigint,
  'verification writes one bounded audit event'
);
select is(
  jsonb_array_length(public.service_fetch_operational_planning_snapshot(
    '2b111111-1111-4111-8111-111111111111',
    '2ba00000-0000-4000-8000-000000000001'
  )->'providerMappings'),
  1,
  'verified mapping enters operational planning immediately'
);
select is(
  (
    select count(*)
    from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = '2ba00000-0000-4000-8000-000000000001'
      and mapping.pos_location_id = '2ba00000-0000-4000-8000-000000000201'
      and mapping.external_catalog_item_id = 'ITEM-VERIFY'
      and mapping.external_variation_id = 'VAR-VERIFY'
      and mapping.verification_status = 'verified'
      and mapping.effective_from <= now()
      and (mapping.effective_to is null or mapping.effective_to > now())
  ),
  1::bigint,
  'one provider identity has at most one current verified authority'
);
select is(
  (select verification_status from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000403'),
  'draft',
  'the duplicate draft is retained as history instead of being deleted or auto-reviewed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->'mappings'
    @> '[{"id":"2ba00000-0000-4000-8000-000000000403"}]'::jsonb,
  false,
  'a draft sibling stops appearing after its provider identity is verified'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  1,
  'the truthful pending total excludes draft siblings of verified identities'
);
select is(
  pg_temp.try_execute($sql$select public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000403',
    '2ba00000-0000-4000-8000-000000000301',
    'verify'
  )$sql$),
  false,
  'a duplicate draft cannot become a second authority after its sibling wins'
);
reset role;
select is(
  (select verification_status from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000403'),
  'draft',
  'a failed duplicate review leaves the sibling unchanged'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000401',
    '2ba00000-0000-4000-8000-000000000302',
    'verify'
  )->>'outcome',
  'already_verified',
  'an exact verification replay returns already_verified after the row lock'
);
select is(
  pg_temp.try_execute($sql$select public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000401',
    '2ba00000-0000-4000-8000-000000000301',
    'verify'
  )$sql$),
  false,
  'a conflicting review after the locked winner is rejected deterministically'
);
reset role;

select is(
  (select count(*) from public.audit_logs where entity_id = '2ba00000-0000-4000-8000-000000000401' and action = 'pos_mapping_verified'),
  1::bigint,
  'verification replay does not duplicate audit history'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000402',
    null,
    'reject'
  )->>'outcome',
  'rejected',
  'manager explicitly rejects a draft suggestion'
);
reset role;

select is(
  (select verification_status from public.pos_catalog_item_mappings where id = '2ba00000-0000-4000-8000-000000000402'),
  'rejected',
  'rejected mapping remains non-authoritative'
);
select is(
  jsonb_array_length(public.service_fetch_operational_planning_snapshot(
    '2b111111-1111-4111-8111-111111111111',
    '2ba00000-0000-4000-8000-000000000001'
  )->'providerMappings'),
  1,
  'rejected mapping remains excluded while the verified mapping stays available'
);
select is(
  (select count(*) from public.audit_logs where entity_id = '2ba00000-0000-4000-8000-000000000402' and action = 'pos_mapping_rejected'),
  1::bigint,
  'rejection writes one bounded audit event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b111111-1111-4111-8111-111111111111', true);
select is(
  public.review_pos_catalog_mapping(
    '2ba00000-0000-4000-8000-000000000001',
    '2ba00000-0000-4000-8000-000000000402',
    null,
    'reject'
  )->>'outcome',
  'already_rejected',
  'an exact rejection replay is deterministic'
);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->'mappings'),
  0,
  'applied decisions immediately remove both rows from the review queue'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2ba00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  0,
  'the queue reports completion only when no current reviewable drafts remain'
);
reset role;

select is(
  (select count(*) from public.audit_logs where entity_id = '2ba00000-0000-4000-8000-000000000402' and action = 'pos_mapping_rejected'),
  1::bigint,
  'rejection replay does not duplicate audit history'
);

insert into public.pos_catalog_item_mappings (
  id, restaurant_id, pos_location_id, external_catalog_item_id,
  external_variation_id, external_name, menu_item_id,
  verification_status, confidence, effective_from
)
select
  ('2bc00000-0000-4000-8000-' || lpad(sequence_number::text, 12, '0'))::uuid,
  '2bb00000-0000-4000-8000-000000000001'::uuid,
  '2bb00000-0000-4000-8000-000000000201'::uuid,
  'ITEM-BULK-' || sequence_number,
  'VAR-BULK-' || sequence_number,
  'Bulk Square Item ' || sequence_number,
  '2bb00000-0000-4000-8000-000000000301'::uuid,
  'draft',
  0.5,
  now() - interval '1 day'
from generate_series(1, 101) sequence_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b333333-3333-4333-8333-333333333333', true);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->'mappings'),
  100,
  'the visible review window remains bounded at 100 rows'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  102,
  'the review response reports the full pending total beyond the visible window'
);
select is(
  public.review_pos_catalog_mapping(
    '2bb00000-0000-4000-8000-000000000001',
    '2bb00000-0000-4000-8000-000000000401',
    '2bb00000-0000-4000-8000-000000000301',
    'verify'
  )->>'outcome',
  'verified',
  'a visible decision succeeds while more than one bounded page remains'
);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->'mappings'),
  100,
  'the bounded review window replenishes immediately after a successful decision'
);
select is(
  (public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  101,
  'the replenished queue keeps the truthful nonzero pending total'
);
reset role;

update public.pos_catalog_item_mappings
set effective_to = now()
where restaurant_id = '2bb00000-0000-4000-8000-000000000001'
  and external_catalog_item_id like 'ITEM-BULK-%';

set local role authenticated;
select set_config('request.jwt.claim.sub', '2b333333-3333-4333-8333-333333333333', true);
select is(
  (public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->>'pendingCount')::integer,
  0,
  'the server pending total reaches zero only after all reviewable bulk rows leave the current window'
);
select is(
  jsonb_array_length(public.list_pos_catalog_mapping_reviews('2bb00000-0000-4000-8000-000000000001')->'mappings'),
  0,
  'a zero pending total is paired with an empty bounded review window'
);
reset role;

select * from finish();
rollback;
