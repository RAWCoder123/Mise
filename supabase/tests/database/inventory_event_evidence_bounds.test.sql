create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_event_evidence_bounds.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(7);

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
   'authenticated', 'authenticated', 'evidence-bounds-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('e0000000-0000-4000-8000-000000000001', 'Evidence Bounds Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('e0000000-0000-4000-8000-000000000001', 'e1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('e0000000-0000-4000-8000-000000000010', 'e0000000-0000-4000-8000-000000000001', 'Bounds Co', 'bounds co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'e0000000-0000-4000-8000-000000000011', 'e0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'e0000000-0000-4000-8000-000000000010', 'Bounds Co',
    'g', 453.592, 'verified', now(), 'e1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_oversized_inventory_event_evidence',
  'oversized inventory evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-meta-oversize-1', 'idem-meta-oversize-1',
      null, null, null,
      jsonb_build_object('note', repeat('x', 9000))
    )
  $sql$),
  'Inventory event metadata exceeds the bounded size',
  'manager JWT cannot mint megabyte-scale inventory metadata'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-ref-oversize-1', 'idem-ref-oversize-1',
      repeat('r', 201), null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source reference exceeds the bounded length',
  'manager JWT cannot mint an oversized source_reference'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'operator_waste',
      'client-reason-oversize-1', 'idem-reason-oversize-1',
      null, repeat('w', 81), null, '{}'::jsonb
    )
  $sql$),
  'Inventory event reason code exceeds the bounded length',
  'manager JWT cannot mint an oversized reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'e0000000-0000-4000-8000-000000000001',
      'e0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-bounds-ok-1', 'idem-bounds-ok-1',
      repeat('r', 200), repeat('c', 80), null,
      jsonb_build_object('note', repeat('n', 500))
    )
  $sql$),
  null,
  'manager JWT can still record inventory evidence at the exact bounds'
);

select is(
  (select source_reference from public.inventory_events
    where client_event_id = 'client-bounds-ok-1'),
  repeat('r', 200),
  'accepted inventory event keeps a 200-character source_reference'
);

select is(
  (select reason_code from public.inventory_events
    where client_event_id = 'client-bounds-ok-1'),
  repeat('c', 80),
  'accepted inventory event keeps an 80-character reason_code'
);

select * from finish();
rollback;
