create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches)\(' supplier_delivery_receipt_provenance.test.sql
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
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'delivery-provenance-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
  ('b1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'delivery-provenance-other@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-000000000001', 'Delivery Provenance Kitchen', 'Cafe', 'UTC'),
  ('b0000000-0000-4000-8000-000000000001', 'Other Delivery Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'manager', 'active'),
  ('b0000000-0000-4000-8000-000000000001', 'b1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('a0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'Provenance Co', 'provenance co'),
  ('b0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000001', 'Other Co', 'other co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'a0000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'a0000000-0000-4000-8000-000000000010', 'Provenance Co',
    'g', 453.592, 'verified', now(), 'a1111111-1111-4111-8111-111111111111'
  );

insert into public.supplier_orders (
  id, restaurant_id, supplier_id, supplier_name, order_message, status, delivery_date
) values
  (
    'a0000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000010', 'Provenance Co', 'Provenance fixture order', 'sent',
    current_date + 1
  ),
  (
    'b0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000010', 'Other Co', 'Other fixture order', 'sent',
    current_date + 1
  );

insert into public.supplier_deliveries (
  id, restaurant_id, supplier_order_id, status, received_at,
  client_delivery_id, idempotency_key
) values
  (
    'a0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000020', 'received', now(),
    'client-delivery-a', 'idem-delivery-a'
  ),
  (
    'b0000000-0000-4000-8000-000000000030', 'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000020', 'received', now(),
    'client-delivery-b', 'idem-delivery-b'
  );

select has_function(
  'private',
  'reject_forged_supplier_delivery_receipt_source',
  'forged supplier_delivery receipt guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'supplier_delivery',
      'forged-no-ref', 'forged-no-ref',
      null, 'supplier_delivery'
    )
  $sql$),
  'Supplier delivery receipt source requires a matching same-tenant delivery',
  'missing delivery reference is rejected with the exact provenance message'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'supplier_delivery',
      'forged-label', 'forged-label',
      'not-a-uuid', 'supplier_delivery'
    )
  $sql$),
  'Supplier delivery receipt source requires a matching same-tenant delivery',
  'non-UUID delivery reference is rejected with the exact provenance message'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'supplier_delivery',
      'forged-missing', 'forged-missing',
      'a0000000-0000-4000-8000-000000000099', 'supplier_delivery'
    )
  $sql$),
  'Supplier delivery receipt source requires a matching same-tenant delivery',
  'unknown delivery UUID is rejected with the exact provenance message'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'supplier_delivery',
      'forged-cross-tenant', 'forged-cross-tenant',
      'b0000000-0000-4000-8000-000000000030', 'supplier_delivery'
    )
  $sql$),
  'Supplier delivery receipt source requires a matching same-tenant delivery',
  'cross-tenant delivery UUID is rejected with the exact provenance message'
);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'receipt', 100, 'g', now(), 'supplier_delivery',
    'linked-delivery', 'linked-delivery',
    'a0000000-0000-4000-8000-000000000030', 'supplier_delivery'
  )).id is not null,
  'same-tenant delivery-linked supplier_delivery receipt is accepted'
);

select ok(
  (public.record_inventory_event(
    'a0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000011',
    'receipt', 50, 'g', now(), 'operator_receipt',
    'operator-receipt', 'operator-receipt'
  )).id is not null,
  'ordinary operator receipts remain accepted without a delivery id'
);

select is(
  (select count(*)::integer from public.inventory_events
    where restaurant_id = 'a0000000-0000-4000-8000-000000000001'
      and source = 'supplier_delivery'
      and source_reference = 'a0000000-0000-4000-8000-000000000030'),
  1,
  'only the legitimate linked supplier_delivery receipt is stored'
);

reset role;

select * from finish();
rollback;
