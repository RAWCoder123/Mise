create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' mise_attributed_inventory_source.test.sql
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
  ('c1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mise-attribution-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-000000000001', 'Mise Attribution Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-000000000001', 'c1111111-1111-4111-8111-111111111111', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000001', 'Attribution Co', 'attribution co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001',
    'Chicken', 'Protein', 'lb', 10, 20, 5, 4,
    'c0000000-0000-4000-8000-000000000010', 'Attribution Co',
    'g', 453.592, 'verified', now(), 'c1111111-1111-4111-8111-111111111111'
  );

select has_function(
  'private',
  'reject_forged_mise_attributed_inventory_source',
  'forged mise-attributed inventory source guard exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'receipt', 100, 'g', now(), 'mise_auto',
      'client-mise-forged-1', 'idem-mise-forged-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source cannot claim Mise attribution',
  'manager JWT cannot mint mise_auto inventory source'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'waste', 50, 'g', now(), 'MiseLearning',
      'client-mise-forged-2', 'idem-mise-forged-2',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  'Inventory event source cannot claim Mise attribution',
  'manager JWT cannot mint case-insensitive Mise* inventory source'
);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
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
  (select actor_type from public.activity_events
    where restaurant_id = 'c0000000-0000-4000-8000-000000000001'
      and idempotency_key = format(
        'inventory_event:%s',
        (select id from public.inventory_events where client_event_id = 'client-operator-ok-1')
      )),
  'user',
  'inventory Activity actor_type follows actor_user_id, not a mise* source prefix'
);

reset role;

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key
    ) values (
      'c0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000011',
      'count', 1, 'g', now(),
      'c1111111-1111-4111-8111-111111111111',
      'mise-fixture-seed', 'fixture-mise-seed-1', 'fixture-mise-seed-1'
    )
  $sql$),
  null,
  'unauthenticated fixture seeds may still use historical mise-* source labels'
);

select * from finish();
rollback;
