create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_correction_supersede_target_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(10);

create or replace function pg_temp.error_of(statement text)
returns text language plpgsql as $$
begin execute statement; return null;
exception when others then return sqlerrm;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('m1111111-1111-4111-8111-11111111111m', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'correction-supersede-target-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('m0000000-0000-4000-8000-00000000000a', 'Correction Supersede Target Kitchen A', 'Cafe', 'UTC'),
  ('m0000000-0000-4000-8000-00000000000b', 'Correction Supersede Target Kitchen B', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('m0000000-0000-4000-8000-00000000000a', 'm1111111-1111-4111-8111-11111111111m', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('m0000000-0000-4000-8000-0000000000a0', 'm0000000-0000-4000-8000-00000000000a', 'Evidence Co A', 'evidence co a'),
  ('m0000000-0000-4000-8000-0000000000b0', 'm0000000-0000-4000-8000-00000000000b', 'Evidence Co B', 'evidence co b');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'm0000000-0000-4000-8000-0000000000a1', 'm0000000-0000-4000-8000-00000000000a',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'm0000000-0000-4000-8000-0000000000a0', 'Evidence Co A',
    'g', 453.592, 'verified', now(), 'm1111111-1111-4111-8111-11111111111m'
  ),
  (
    'm0000000-0000-4000-8000-0000000000a2', 'm0000000-0000-4000-8000-00000000000a',
    'Beef', 'Protein', 'lb', 8, 16, 4, 5,
    'm0000000-0000-4000-8000-0000000000a0', 'Evidence Co A',
    'g', 453.592, 'verified', now(), 'm1111111-1111-4111-8111-11111111111m'
  ),
  (
    'm0000000-0000-4000-8000-0000000000b1', 'm0000000-0000-4000-8000-00000000000b',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'm0000000-0000-4000-8000-0000000000b0', 'Evidence Co B',
    'g', 453.592, 'verified', now(), 'm1111111-1111-4111-8111-11111111111m'
  );

-- Target waste event on item A1 that legitimate corrections may supersede.
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  reason_code, metadata
) values (
  'm0000000-0000-4000-8000-0000000000e1',
  'm0000000-0000-4000-8000-00000000000a',
  'm0000000-0000-4000-8000-0000000000a1',
  'waste', 100, 'g', now(),
  'm1111111-1111-4111-8111-11111111111m',
  'operator_waste', 'client-corr-supersede-target-waste-a1', 'idem-corr-supersede-target-waste-a1',
  'spoilage', '{}'::jsonb
);

-- Sibling waste on item A2 for cross-item forge attempts.
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  reason_code, metadata
) values (
  'm0000000-0000-4000-8000-0000000000e2',
  'm0000000-0000-4000-8000-00000000000a',
  'm0000000-0000-4000-8000-0000000000a2',
  'waste', 50, 'g', now(),
  'm1111111-1111-4111-8111-11111111111m',
  'operator_waste', 'client-corr-supersede-target-waste-a2', 'idem-corr-supersede-target-waste-a2',
  'spoilage', '{}'::jsonb
);

-- Foreign-restaurant waste for cross-tenant forge attempts.
insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  reason_code, metadata
) values (
  'm0000000-0000-4000-8000-0000000000e3',
  'm0000000-0000-4000-8000-00000000000b',
  'm0000000-0000-4000-8000-0000000000b1',
  'waste', 75, 'g', now(),
  'm1111111-1111-4111-8111-11111111111m',
  'operator_waste', 'client-corr-supersede-target-waste-b1', 'idem-corr-supersede-target-waste-b1',
  'spoilage', '{}'::jsonb
);

select has_function(
  'private',
  'enforce_inventory_correction_supersede_target_evidence',
  'correction supersede target evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, supersedes_event_id, metadata
    ) values (
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -50, 'g', now(),
      'm1111111-1111-4111-8111-11111111111m',
      'operator_correction', 'client-corr-supersede-cross-item-1',
      'idem-corr-supersede-cross-item-1',
      'waste_correction', 'm0000000-0000-4000-8000-0000000000e2',
      '{}'::jsonb
    )
  $sql$),
  'Inventory correction must supersede an event for the same inventory item',
  'direct insert rejects cross-item supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, supersedes_event_id, metadata
    ) values (
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -50, 'g', now(),
      'm1111111-1111-4111-8111-11111111111m',
      'operator_correction', 'client-corr-supersede-cross-tenant-1',
      'idem-corr-supersede-cross-tenant-1',
      'waste_correction', 'm0000000-0000-4000-8000-0000000000e3',
      '{}'::jsonb
    )
  $sql$),
  'Inventory correction must supersede an event in the same restaurant',
  'direct insert rejects cross-restaurant supersession'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, supersedes_event_id, metadata
    ) values (
      'm0000000-0000-4000-8000-0000000000c1',
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -100, 'g', now(),
      'm1111111-1111-4111-8111-11111111111m',
      'operator_correction', 'client-corr-supersede-direct-ok-1',
      'idem-corr-supersede-direct-ok-1',
      'waste_correction', 'm0000000-0000-4000-8000-0000000000e1',
      '{}'::jsonb
    )
  $sql$),
  null,
  'direct insert accepts same-item supersession'
);

select is(
  (select
     (supersedes_event_id = 'm0000000-0000-4000-8000-0000000000e1')::text
     || '|' || quantity::text
     || '|' || inventory_item_id::text
   from public.inventory_events
   where id = 'm0000000-0000-4000-8000-0000000000c1'),
  'true|-100|m0000000-0000-4000-8000-0000000000a1',
  'accepted direct supersession stores target identity and quantity'
);

-- Orphan corrections without supersedes_event_id remain accepted here.
-- Requiring supersedes is #394 and stays outside this tip.
select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -10, 'g', now(),
      'm1111111-1111-4111-8111-11111111111m',
      'operator_correction', 'client-corr-supersede-orphan-ok-1',
      'idem-corr-supersede-orphan-ok-1',
      'waste_correction', '{}'::jsonb
    )
  $sql$),
  null,
  'direct insert still accepts corrections without supersedes_event_id'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'm1111111-1111-4111-8111-11111111111m', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -25, 'g', now(), 'operator_correction',
      'client-corr-supersede-rpc-cross-item-1',
      'idem-corr-supersede-rpc-cross-item-1',
      null, 'waste_correction', 'm0000000-0000-4000-8000-0000000000e2',
      '{}'::jsonb
    )
  $sql$),
  'Superseded event not found for inventory item',
  'manager JWT cannot mint a cross-item correction via RPC'
);

-- Seed a fresh same-item waste for the RPC accept path (e1 already superseded).
reset role;

insert into public.inventory_events (
  id, restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
  effective_at, actor_user_id, source, client_event_id, idempotency_key,
  reason_code, metadata
) values (
  'm0000000-0000-4000-8000-0000000000e4',
  'm0000000-0000-4000-8000-00000000000a',
  'm0000000-0000-4000-8000-0000000000a1',
  'waste', 40, 'g', now(),
  'm1111111-1111-4111-8111-11111111111m',
  'operator_waste', 'client-corr-supersede-target-waste-a1-b',
  'idem-corr-supersede-target-waste-a1-b',
  'spoilage', '{}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'm1111111-1111-4111-8111-11111111111m', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -40, 'g', now(), 'operator_correction',
      'client-corr-supersede-rpc-ok-1',
      'idem-corr-supersede-rpc-ok-1',
      null, 'waste_correction', 'm0000000-0000-4000-8000-0000000000e4',
      '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record a same-item correction via RPC'
);

select is(
  (select
     (supersedes_event_id = 'm0000000-0000-4000-8000-0000000000e4')::text
     || '|' || quantity::text
   from public.inventory_events
   where client_event_id = 'client-corr-supersede-rpc-ok-1'),
  'true|-40',
  'accepted RPC correction stores supersedes identity and quantity'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'm0000000-0000-4000-8000-00000000000a',
      'm0000000-0000-4000-8000-0000000000a1',
      'correction', -40, 'g', now(), 'operator_correction',
      'client-corr-supersede-rpc-second-1',
      'idem-corr-supersede-rpc-second-1',
      null, 'waste_correction', 'm0000000-0000-4000-8000-0000000000e4',
      '{}'::jsonb
    )
  $sql$),
  'Inventory event has already been superseded',
  'second supersession of the same target remains fail-closed'
);

select * from finish();
rollback;
