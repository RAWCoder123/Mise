create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' unsupported_inventory_receipt_source.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(8);

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
  ('e1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'receipt-source-allowlist-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-000000000001', 'Receipt Source Allowlist Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'Allowlist Co', 'allowlist co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'e0000000-0000-4000-8000-000000000010', 'Allowlist Co',
    'g', 453.592, 'verified', now(), 'e1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_unsupported_inventory_receipt_source',
  'unsupported inventory receipt source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'receiving',
      'client-receipt-forged-1', 'idem-receipt-forged-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory receipt source must be operator_receipt or supplier_delivery',
  'manager JWT cannot mint an arbitrary receiving receipt source'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 50, 'g', now(), 'Operator_Receipt',
      'client-receipt-forged-2', 'idem-receipt-forged-2',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory receipt source must be operator_receipt or supplier_delivery',
  'manager JWT cannot mint a case-variant operator_receipt label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-operator-ok-1', 'idem-operator-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record operator_receipt inventory source'
);

select is(
  (select source from public.inventory_events
    where client_event_id = 'client-operator-ok-1'),
  'operator_receipt',
  'accepted operator receipt keeps its source label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'waste', 25, 'g', now(), 'operator_waste',
      'client-waste-ok-1', 'idem-waste-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-receipt inventory sources remain unconstrained by the receipt allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(),
      'e1111111-1111-4111-8111-111111111111',
      'supplier_delivery', 'e0000000-0000-4000-8000-000000000020',
      'fixture-supplier-delivery-1', 'fixture-supplier-delivery-1'
    )
  $sql$),
  null,
  'unauthenticated fixture seeds may still stamp supplier_delivery on receipts'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(),
      'e1111111-1111-4111-8111-111111111111',
      'receiving', 'fixture-receiving-blocked-1', 'fixture-receiving-blocked-1'
    )
  $sql$),
  'Inventory receipt source must be operator_receipt or supplier_delivery',
  'direct inserts also reject unsupported receipt sources'
);

select * from finish();
rollback;
