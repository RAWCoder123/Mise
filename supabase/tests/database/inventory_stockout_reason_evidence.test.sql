create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_stockout_reason_evidence.test.sql
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
  ('a1111111-1111-4111-8111-111111111122', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stockout-reason-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('a0000000-0000-4000-8000-000000000022', 'Stockout Reason Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('a0000000-0000-4000-8000-000000000022', 'a1111111-1111-4111-8111-111111111122', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('a0000000-0000-4000-8000-000000000032', 'a0000000-0000-4000-8000-000000000022', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'a0000000-0000-4000-8000-000000000033', 'a0000000-0000-4000-8000-000000000022',
    'Flour', 'Dry Goods', 'lb', 10, 20, 5, 2,
    'a0000000-0000-4000-8000-000000000032', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'a1111111-1111-4111-8111-111111111122'
  );

select has_function(
  'private',
  'enforce_inventory_stockout_reason_evidence',
  'stockout reason evidence guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111122', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-bare-1', 'idem-stockout-bare-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory stockout events require a reason code',
  'manager JWT cannot mint stockout without a reason code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-bad-1', 'idem-stockout-bad-1',
      null, 'ran_out', null, '{}'::jsonb
    )
  $sql$),
  'Inventory stockout reason code is not allowed',
  'manager JWT cannot mint stockout with a non-allowlisted reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-case-1', 'idem-stockout-case-1',
      null, 'Under_Ordered', null, '{}'::jsonb
    )
  $sql$),
  'Inventory stockout reason code is not allowed',
  'manager JWT cannot mint stockout with a case-variant reason'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'stockout', 0, 'g', now(), 'operator_stockout',
      'client-stockout-ok-1', 'idem-stockout-ok-1',
      null, 'under_ordered', null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can mint stockout with an allowlisted reason'
);

select is(
  (select reason_code from public.inventory_events
    where client_event_id = 'client-stockout-ok-1'),
  'under_ordered',
  'accepted stockout keeps the allowlisted reason_code'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'receipt', 25, 'g', now(), 'operator_receipt',
      'client-receipt-no-reason-1', 'idem-receipt-no-reason-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-stockout events remain unconstrained by the stockout reason allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'a0000000-0000-4000-8000-000000000022',
      'a0000000-0000-4000-8000-000000000033',
      'stockout', 0, 'g', now(),
      'a1111111-1111-4111-8111-111111111122',
      'operator_stockout', 'client-stockout-direct-1', 'idem-stockout-direct-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory stockout events require a reason code',
  'direct inventory_events insert cannot bypass the stockout reason guard'
);

select * from finish();
rollback;
