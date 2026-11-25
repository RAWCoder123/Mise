create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' unsupported_inventory_usage_source.test.sql
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
  ('f1111111-1111-4111-8111-111111111113', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'usage-source-allowlist-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('f0000000-0000-4000-8000-000000000003', 'Usage Source Allowlist Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('f0000000-0000-4000-8000-000000000003', 'f1111111-1111-4111-8111-111111111113', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('f0000000-0000-4000-8000-000000000030', 'f0000000-0000-4000-8000-000000000003', 'Allowlist Co', 'allowlist co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'f0000000-0000-4000-8000-000000000031', 'f0000000-0000-4000-8000-000000000003',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'f0000000-0000-4000-8000-000000000030', 'Allowlist Co',
    'g', 453.592, 'verified', now(), 'f1111111-1111-4111-8111-111111111113'
  );

select has_function(
  'private',
  'reject_unsupported_inventory_usage_source',
  'unsupported inventory usage source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1111111-1111-4111-8111-111111111113', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'usage', 100, 'g', now(), 'manual',
      'client-usage-forged-1', 'idem-usage-forged-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory usage source must be operator_usage',
  'manager JWT cannot mint an arbitrary manual usage source'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'usage', 100, 'g', now(), 'Operator_Usage',
      'client-usage-forged-2', 'idem-usage-forged-2',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory usage source must be operator_usage',
  'manager JWT cannot mint a case-variant operator_usage label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'usage', 100, 'g', now(), 'demo_usage',
      'client-usage-forged-3', 'idem-usage-forged-3',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory usage source must be operator_usage',
  'manager JWT cannot mint a demo_usage usage source on hosted ledger'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'usage', 100, 'g', now(), 'operator_usage',
      'client-usage-ok-1', 'idem-usage-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can still record operator_usage inventory source'
);

select is(
  (select source from public.inventory_events
    where client_event_id = 'client-usage-ok-1'),
  'operator_usage',
  'accepted operator usage keeps its source label'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'receipt', 100, 'g', now(), 'operator_receipt',
      'client-receipt-ok-1', 'idem-receipt-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'non-usage inventory sources remain unconstrained by the usage allowlist'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'f0000000-0000-4000-8000-000000000003',
      'f0000000-0000-4000-8000-000000000031',
      'usage', 50, 'g', now(),
      'f1111111-1111-4111-8111-111111111113',
      'manual', 'fixture-manual-usage-blocked-1', 'fixture-manual-usage-blocked-1'
    )
  $sql$),
  'Inventory usage source must be operator_usage',
  'direct inserts also reject unsupported usage sources'
);

select * from finish();
rollback;
