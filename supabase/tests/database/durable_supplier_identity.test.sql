begin;

select plan(66);

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

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '3c111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'supplier-manager-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '3c222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'supplier-staff-a@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '3c333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'supplier-manager-b@mise.test',
    crypt('password', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.restaurants (id, name, cuisine_type, timezone)
values
  ('3c000000-0000-4000-8000-000000000001', 'Durable Supplier Kitchen A', 'Cafe', 'UTC'),
  ('3d000000-0000-4000-8000-000000000001', 'Durable Supplier Kitchen B', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status)
values
  ('3c000000-0000-4000-8000-000000000001', '3c111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('3c000000-0000-4000-8000-000000000001', '3c222222-2222-4222-8222-222222222222', 'staff', 'active'),
  ('3d000000-0000-4000-8000-000000000001', '3c333333-3333-4333-8333-333333333333', 'manager', 'active');

select has_table('public', 'suppliers', 'durable suppliers are a first-class public tenant resource');
select col_type_is('public', 'suppliers', 'id', 'uuid', 'supplier authority uses a UUID primary identity');
select col_type_is('public', 'inventory_items', 'supplier_id', 'uuid', 'inventory carries durable supplier identity');
select col_type_is('public', 'purchase_recommendations', 'supplier_id', 'uuid', 'recommendations carry durable supplier identity');
select col_type_is('public', 'supplier_orders', 'supplier_id', 'uuid', 'orders carry durable supplier identity');
select col_type_is('public', 'supplier_recipients', 'supplier_id', 'uuid', 'recipients carry durable supplier identity');
select col_type_is('private', 'supplier_email_deliveries', 'supplier_id', 'uuid', 'new delivery proof can bind durable supplier identity');

select is(has_table_privilege('authenticated', 'public.suppliers', 'SELECT'), true,
  'authenticated members can reach the tenant-filtered supplier directory');
select is(has_table_privilege('authenticated', 'public.suppliers', 'INSERT'), false,
  'authenticated clients cannot insert supplier identity directly');
select is(has_table_privilege('authenticated', 'public.suppliers', 'UPDATE'), false,
  'authenticated clients cannot rename supplier identity directly');
select is(has_table_privilege('authenticated', 'public.suppliers', 'DELETE'), false,
  'authenticated clients cannot delete supplier identity directly');
select is(has_table_privilege('service_role', 'public.suppliers', 'INSERT'), false,
  'service role has no unnecessary direct supplier DML authority');
select is(has_function_privilege('authenticated', 'public.create_supplier(uuid,text)', 'EXECUTE'), true,
  'authenticated operators can reach the role-checked creation RPC');
select is(has_function_privilege('authenticated', 'public.rename_supplier(uuid,uuid,text)', 'EXECUTE'), true,
  'authenticated operators can reach the role-checked rename RPC');
select is(has_function_privilege('authenticated', 'public.reassign_inventory_item_supplier(uuid,uuid,uuid)', 'EXECUTE'), true,
  'authenticated operators can reach the role-checked reassignment RPC');
select is(has_function_privilege('authenticated', 'public.upsert_supplier_recipient(uuid,uuid,text)', 'EXECUTE'), true,
  'recipient mutation resolves by durable supplier ID');
select is(to_regprocedure('public.upsert_supplier_recipient(uuid,text,text)'), null::regprocedure,
  'the legacy free-form supplier-name recipient authority is retired');
select is(has_function_privilege('authenticated', 'private.backfill_durable_supplier_identity()', 'EXECUTE'), false,
  'the one-time identity backfill is unavailable to clients');

-- Reproduce a pre-003C name-only state inside this rolled-back proof. This is
-- the only test-only relaxation of the post-migration NOT NULL boundary.
alter table public.inventory_items alter column supplier_id drop not null;

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name, supplier_id
) values
  (
    '3c000000-0000-4000-8000-000000000801',
    '3c000000-0000-4000-8000-000000000001',
    'Backfill apples', 'Produce', 'case', 1, 8, 2, 12,
    '  Backfill   Produce  ', null
  ),
  (
    '3c000000-0000-4000-8000-000000000802',
    '3c000000-0000-4000-8000-000000000001',
    'Backfill pears', 'Produce', 'case', 1, 8, 2, 12,
    'backfill produce', null
  ),
  (
    '3d000000-0000-4000-8000-000000000801',
    '3d000000-0000-4000-8000-000000000001',
    'Backfill apples B', 'Produce', 'case', 1, 8, 2, 12,
    'Backfill Produce', null
  );

select lives_ok(
  $$select private.backfill_durable_supplier_identity()$$,
  'the retained migration helper upgrades deterministic safe historical names'
);
select is(
  (select count(distinct supplier_id) from public.inventory_items
   where id in (
     '3c000000-0000-4000-8000-000000000801',
     '3c000000-0000-4000-8000-000000000802'
   )),
  1::bigint,
  'exact normalized-name equality maps historical rows to one identity within a tenant'
);
select isnt(
  (select supplier_id from public.inventory_items where id = '3c000000-0000-4000-8000-000000000801'),
  (select supplier_id from public.inventory_items where id = '3d000000-0000-4000-8000-000000000801'),
  'the same normalized historical name never merges across restaurants'
);
select lives_ok(
  $$select private.backfill_durable_supplier_identity()$$,
  'the durable identity backfill is idempotent'
);
select is(
  (select count(*) from public.suppliers where normalized_name = 'backfill produce'),
  2::bigint,
  'idempotent backfill retains exactly one matching identity per tenant'
);

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_name, supplier_id
) values (
  '3c000000-0000-4000-8000-000000000803',
  '3c000000-0000-4000-8000-000000000001',
  'Malformed history', 'Produce', 'case', 1, 8, 2, 12,
  E'Unsafe\nSupplier', null
);
select is(
  pg_temp.try_execute($$select private.backfill_durable_supplier_identity()$$),
  false,
  'malformed required history fails closed instead of fabricating identity'
);
delete from public.inventory_items where id = '3c000000-0000-4000-8000-000000000803';

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$select public.create_supplier(
    '3c000000-0000-4000-8000-000000000001', 'RPC Created Supplier'
  )$$,
  'a manager can create a tenant-scoped durable supplier'
);
reset role;
select ok(
  (select id is not null from public.suppliers
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and normalized_name = 'rpc created supplier'),
  'supplier creation persists a stable non-null UUID'
);

insert into public.suppliers (id, restaurant_id, display_name, normalized_name)
values
  (
    '3c000000-0000-4000-8000-000000000010',
    '3c000000-0000-4000-8000-000000000001',
    'Metro Produce', 'metro produce'
  ),
  (
    '3c000000-0000-4000-8000-000000000020',
    '3c000000-0000-4000-8000-000000000001',
    'Metro Produce East', 'metro produce east'
  ),
  (
    '3d000000-0000-4000-8000-000000000010',
    '3d000000-0000-4000-8000-000000000001',
    'Metro Produce', 'metro produce'
  );

select is(
  pg_temp.try_execute($$insert into public.suppliers (
    restaurant_id, display_name, normalized_name
  ) values (
    '3c000000-0000-4000-8000-000000000001', 'METRO PRODUCE', 'metro produce'
  )$$),
  false,
  'an exact normalized duplicate is explicitly prohibited within one tenant'
);
select is(
  pg_temp.try_execute($$insert into public.suppliers (
    restaurant_id, display_name, normalized_name
  ) values (
    '3c000000-0000-4000-8000-000000000001', E'Unsafe\nSupplier', E'unsafe\nsupplier'
  )$$),
  false,
  'supplier display names reject control characters'
);
select is(
  pg_temp.try_execute($$insert into public.suppliers (
    restaurant_id, display_name, normalized_name
  ) values (
    '3c000000-0000-4000-8000-000000000001', repeat('x', 161), repeat('x', 161)
  )$$),
  false,
  'supplier display names are bounded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c222222-2222-4222-8222-222222222222', true);
select is(
  pg_temp.try_execute($$select public.create_supplier(
    '3c000000-0000-4000-8000-000000000001', 'Staff Forgery'
  )$$),
  false,
  'staff cannot create purchasing authority'
);
select is(
  pg_temp.try_execute($$select public.rename_supplier(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000010',
    'Staff Rename'
  )$$),
  false,
  'staff cannot rename purchasing authority'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($$select public.rename_supplier(
    '3d000000-0000-4000-8000-000000000001',
    '3d000000-0000-4000-8000-000000000010',
    'Cross-tenant Rename'
  )$$),
  false,
  'a manager cannot rename another restaurant supplier'
);
select is((select count(*) from public.suppliers), 4::bigint,
  'supplier RLS exposes only the manager restaurant directory');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.suppliers), 2::bigint,
  'same-name supplier rows remain separately tenant isolated');
reset role;

insert into public.restaurant_email_connections (
  restaurant_id, provider, status, sender_email, last_verified_at
) values (
  '3c000000-0000-4000-8000-000000000001',
  'gmail', 'connected', 'orders@durable.test', now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$select public.upsert_supplier_recipient(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000010',
    ' ORDERS@METRO.EXAMPLE '
  )$$,
  'recipient configuration binds to a durable same-tenant supplier ID'
);
reset role;
select is(
  (select supplier_id from public.supplier_recipients
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and email = 'orders@metro.example'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'recipient authority persists the exact supplier ID'
);

update public.system_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true,
    operational_mode = 'normal', gmail_delivery_enabled = true
where singleton;
update public.restaurant_operational_controls
set ordering_policy = 'draft_only', order_drafting_enabled = true,
    gmail_delivery_enabled = true
where restaurant_id = '3c000000-0000-4000-8000-000000000001';

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit, canonical_unit_verification_status,
  canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    '3c000000-0000-4000-8000-000000000101',
    '3c000000-0000-4000-8000-000000000001',
    'Metro apples', 'Produce', 'each', 0, 8, 2, 12,
    '3c000000-0000-4000-8000-000000000010', 'Metro Produce',
    'each', 1, 'verified', now(), '3c111111-1111-4111-8111-111111111111'
  ),
  (
    '3c000000-0000-4000-8000-000000000102',
    '3c000000-0000-4000-8000-000000000001',
    'East pears', 'Produce', 'each', 0, 8, 2, 12,
    '3c000000-0000-4000-8000-000000000020', 'Metro Produce East',
    'each', 1, 'verified', now(), '3c111111-1111-4111-8111-111111111111'
  ),
  (
    '3c000000-0000-4000-8000-000000000103',
    '3c000000-0000-4000-8000-000000000001',
    'Reassignment oranges', 'Produce', 'each', 0, 8, 2, 12,
    '3c000000-0000-4000-8000-000000000010', 'Metro Produce',
    'each', 1, 'verified', now(), '3c111111-1111-4111-8111-111111111111'
  );

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key
) values
  (
    '3c000000-0000-4000-8000-000000000201',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000101',
    'count', 0, 'each', clock_timestamp(),
    '3c111111-1111-4111-8111-111111111111',
    'mise-003c-test', 'metro-count', 'metro-count'
  ),
  (
    '3c000000-0000-4000-8000-000000000202',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000102',
    'count', 0, 'each', clock_timestamp(),
    '3c111111-1111-4111-8111-111111111111',
    'mise-003c-test', 'east-count', 'east-count'
  ),
  (
    '3c000000-0000-4000-8000-000000000203',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000103',
    'count', 0, 'each', clock_timestamp(),
    '3c111111-1111-4111-8111-111111111111',
    'mise-003c-test', 'reassign-count', 'reassign-count'
  );

insert into public.purchase_recommendations (
  id, restaurant_id, inventory_item_id, item_name, supplier_id, supplier_name,
  recommended_quantity, unit, reason, urgency, status, generation_source
) values
  (
    '3c000000-0000-4000-8000-000000000301',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000101',
    'Metro apples', '3c000000-0000-4000-8000-000000000020', 'Metro Produce East',
    3, 'each', 'Durable supplier approval', 'high', 'pending', 'manual'
  ),
  (
    '3c000000-0000-4000-8000-000000000302',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000102',
    'East pears', '3c000000-0000-4000-8000-000000000020', 'Metro Produce East',
    3, 'each', 'Independent durable supplier approval', 'high', 'pending', 'manual'
  ),
  (
    '3c000000-0000-4000-8000-000000000303',
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000103',
    'Reassignment oranges', '3c000000-0000-4000-8000-000000000010', 'Metro Produce',
    3, 'each', 'Reassignment invalidation fixture', 'high', 'pending', 'manual'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select is(
  (select recommendation.supplier_id
   from public.purchase_recommendations recommendation
   where recommendation.id = '3c000000-0000-4000-8000-000000000301'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'client-supplied recommendation text or ID cannot override authoritative inventory supplier identity'
);
select is(
  public.approve_purchase_recommendation(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000301', 3
  )->>'outcome',
  'applied',
  'a valid recommendation approves using durable supplier authority'
);
reset role;
select is(
  (select supplier_id from public.supplier_orders
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and status = 'draft'
     and supplier_id = '3c000000-0000-4000-8000-000000000010'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'approval creates a draft for the exact supplier ID'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select is(
  public.approve_purchase_recommendation(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000301', 3
  )->>'outcome',
  'already_applied',
  'durable supplier approval replay remains idempotent'
);
select is(
  public.approve_purchase_recommendation(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000302', 3
  )->>'outcome',
  'applied',
  'a second supplier approves independently'
);
reset role;
select is(
  (select count(*) from public.supplier_orders
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and status = 'draft'
     and supplier_id in (
       '3c000000-0000-4000-8000-000000000010',
       '3c000000-0000-4000-8000-000000000020'
     )),
  2::bigint,
  'similar supplier display names with distinct IDs never collapse into one draft'
);
select is(
  (select count(*) from public.supplier_orders orders
   join public.purchase_recommendations recommendation
     on recommendation.restaurant_id = orders.restaurant_id
    and recommendation.supplier_order_id = orders.id
    and recommendation.supplier_id = orders.supplier_id
   where orders.restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and recommendation.id in (
       '3c000000-0000-4000-8000-000000000301',
       '3c000000-0000-4000-8000-000000000302'
     )),
  2::bigint,
  'each approved recommendation is attached only to its supplier-ID draft'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$select public.reassign_inventory_item_supplier(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000103',
    '3c000000-0000-4000-8000-000000000020'
  )$$,
  'authorized reassignment is a distinct supplier-ID mutation'
);
reset role;
select is(
  (select supplier_id from public.inventory_items
   where id = '3c000000-0000-4000-8000-000000000103'),
  '3c000000-0000-4000-8000-000000000020'::uuid,
  'reassignment changes inventory authority to the selected supplier ID'
);
select ok(
  not exists (
    select 1 from public.purchase_recommendations
    where id = '3c000000-0000-4000-8000-000000000303'
      and status = 'pending'
      and supplier_id = '3c000000-0000-4000-8000-000000000010'
  ),
  'reassignment invalidates the stale pending recommendation for the old supplier'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select is(
  pg_temp.try_execute($$select public.reassign_inventory_item_supplier(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000101',
    '3d000000-0000-4000-8000-000000000010'
  )$$),
  false,
  'client-provided cross-tenant supplier IDs are rejected server-side'
);
select is(
  pg_temp.try_execute($$select public.reassign_inventory_item_supplier(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000101',
    '3c000000-0000-4000-8000-000000000020'
  )$$),
  false,
  'an approved unsent recommendation cannot be silently reparented'
);
reset role;

create temporary table supplier_content_before_rename as
select public.preview_supplier_send_content(
  '3c000000-0000-4000-8000-000000000001',
  (select id from public.supplier_orders
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and supplier_id = '3c000000-0000-4000-8000-000000000010'
     and status = 'draft')
) as preview;

select is((select preview->>'ready' from supplier_content_before_rename), 'true',
  'server preview is ready for the durable supplier draft');
select is((select preview->>'contentVersion' from supplier_content_before_rename),
  'mise.supplier_send.v2', 'new canonical supplier-send proof uses explicit v2');
select is((select preview->>'supplierId' from supplier_content_before_rename),
  '3c000000-0000-4000-8000-000000000010',
  'the canonical server snapshot binds top-level supplier identity');
select is((select preview->'lines'->0->>'supplierId' from supplier_content_before_rename),
  '3c000000-0000-4000-8000-000000000010',
  'each canonical line binds the exact supplier identity');
select ok((select preview->>'contentFingerprint' from supplier_content_before_rename)
    ~ '^[a-f0-9]{64}$',
  'the v2 canonical snapshot remains deterministically fingerprinted');

set local role authenticated;
select set_config('request.jwt.claim.sub', '3c111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$select public.rename_supplier(
    '3c000000-0000-4000-8000-000000000001',
    '3c000000-0000-4000-8000-000000000010',
    'Metro Produce & Foods'
  )$$,
  'authorized rename preserves the durable supplier identity'
);
reset role;

select is(
  (select id from public.suppliers
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and display_name = 'Metro Produce & Foods'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'rename changes presentation without changing supplier ID'
);
select is(
  (select supplier_id from public.supplier_recipients
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and email = 'orders@metro.example'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'rename does not detach the configured recipient'
);
select is(
  (select supplier_id from public.inventory_items
   where id = '3c000000-0000-4000-8000-000000000101'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'rename leaves inventory authority on the same supplier ID'
);
select is(
  (select supplier_id from public.purchase_recommendations
   where id = '3c000000-0000-4000-8000-000000000301'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'rename leaves approved recommendation authority on the same supplier ID'
);
select is(
  (select supplier_id from public.supplier_orders
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and supplier_id = '3c000000-0000-4000-8000-000000000010'),
  '3c000000-0000-4000-8000-000000000010'::uuid,
  'rename leaves the existing unsent draft on the same supplier ID'
);
select isnt(
  public.preview_supplier_send_content(
    '3c000000-0000-4000-8000-000000000001',
    (select id from public.supplier_orders
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and supplier_id = '3c000000-0000-4000-8000-000000000010')
  )->>'contentFingerprint',
  (select preview->>'contentFingerprint' from supplier_content_before_rename),
  'a display rename changes reviewed content and requires fresh MISE-003B approval'
);
select is(
  (select count(*) from public.audit_logs
   where restaurant_id = '3c000000-0000-4000-8000-000000000001'
     and action = 'supplier_renamed'
     and entity_id = '3c000000-0000-4000-8000-000000000010'),
  1::bigint,
  'supplier rename is recorded in the durable audit trail'
);
select is(
  (select supplier_name from public.inventory_items
   where id = '3c000000-0000-4000-8000-000000000101'),
  'Metro Produce',
  'historical inventory display snapshots remain readable after rename'
);

set constraints all immediate;
select is(
  pg_temp.try_execute($$insert into public.inventory_items (
    restaurant_id, item_name, category, unit, current_quantity,
    par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name
  ) values (
    '3c000000-0000-4000-8000-000000000001',
    'Cross-tenant forgery', 'Produce', 'case', 0, 8, 2, 12,
    '3d000000-0000-4000-8000-000000000010', 'Metro Produce'
  )$$),
  false,
  'the composite tenant foreign key rejects direct cross-tenant supplier forgery'
);

-- Historical v1 evidence remains honest: it is readable with no fabricated
-- supplier ID. New v2 rows, by contrast, must carry durable identity.
select lives_ok(
  format(
    $sql$insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, content_version,
      content_fingerprint, authority_version, authority_fingerprint,
      approved_action_id, claimed_recommendation_ids, claimed_from,
      claimed_to, claimed_subject, credential_generation,
      claimed_content_revision, authority_evaluated_at, supplier_id
    ) values (
      '3c000000-0000-4000-8000-000000000001', %L,
      '3c111111-1111-4111-8111-111111111111', %L,
      '3c000000-0000-4000-8000-000000000901', 'unknown', '<legacy-v1@mise.test>',
      'mise.supplier_send.v1', %L, 'mise.purchase_authority.v1', %L,
      %L, array['3c000000-0000-4000-8000-000000000301'::uuid],
      'orders@durable.test', 'orders@metro.example', 'Historical v1 claim',
      1, 1, now(), null
    )$sql$,
    (select id from public.supplier_orders
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and supplier_id = '3c000000-0000-4000-8000-000000000010'),
    (select id from public.supplier_orders
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and supplier_id = '3c000000-0000-4000-8000-000000000010'),
    repeat('a', 64), repeat('b', 64),
    (select id from public.mise_actions
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and idempotency_key = format(
         'send_supplier_order:%s',
         (select id from public.supplier_orders
          where restaurant_id = '3c000000-0000-4000-8000-000000000001'
            and supplier_id = '3c000000-0000-4000-8000-000000000010')
       ))
  ),
  'an immutable historical v1 claim remains valid without invented supplier-ID proof'
);
select is(
  (select supplier_id from private.supplier_email_deliveries
   where claim_token = '3c000000-0000-4000-8000-000000000901'),
  null::uuid,
  'legacy v1 evidence remains explicitly unresolved rather than rewritten'
);
select is(
  pg_temp.try_execute(format(
    $sql$insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, content_version,
      content_fingerprint, authority_version, authority_fingerprint,
      approved_action_id, claimed_recommendation_ids, claimed_from,
      claimed_to, claimed_subject, credential_generation,
      claimed_content_revision, authority_evaluated_at, supplier_id
    ) values (
      '3c000000-0000-4000-8000-000000000001', %L,
      '3c111111-1111-4111-8111-111111111111', %L,
      '3c000000-0000-4000-8000-000000000902', 'unknown', '<invalid-v2@mise.test>',
      'mise.supplier_send.v2', %L, 'mise.purchase_authority.v1', %L,
      %L, array['3c000000-0000-4000-8000-000000000302'::uuid],
      'orders@durable.test', 'east@metro.example', 'Invalid v2 claim',
      1, 1, now(), null
    )$sql$,
    (select id from public.supplier_orders
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and supplier_id = '3c000000-0000-4000-8000-000000000020'),
    (select id from public.supplier_orders
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and supplier_id = '3c000000-0000-4000-8000-000000000020'),
    repeat('c', 64), repeat('d', 64),
    (select id from public.mise_actions
     where restaurant_id = '3c000000-0000-4000-8000-000000000001'
       and idempotency_key = format(
         'send_supplier_order:%s',
         (select id from public.supplier_orders
          where restaurant_id = '3c000000-0000-4000-8000-000000000001'
            and supplier_id = '3c000000-0000-4000-8000-000000000020')
       ))
  )),
  false,
  'a new v2 claim cannot omit durable supplier identity'
);

select * from finish();
rollback;
