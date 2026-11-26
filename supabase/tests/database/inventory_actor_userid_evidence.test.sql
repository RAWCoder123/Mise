create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_actor_userid_evidence.test.sql
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
  ('k1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'actor-userid-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('k0000000-0000-4000-8000-00000000000a', 'Actor UserId Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('k0000000-0000-4000-8000-00000000000a', 'k1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('k0000000-0000-4000-8000-000000000090', 'k0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'k0000000-0000-4000-8000-000000000091', 'k0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'k0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'k1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_actor_userid_evidence',
  'actor userid evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'k0000000-0000-4000-8000-00000000000a',
      'k0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      null,
      'operator_adjustment', 'client-actor-userid-null-1', 'idem-actor-userid-null-1',
      null, '{}'::jsonb
    )
  $sql$),
  'Inventory event actor is required',
  'direct inventory_events insert cannot mint an unattributable null actor'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, client_event_id, idempotency_key,
      reason_code, metadata
    ) values (
      'k0000000-0000-4000-8000-00000000000a',
      'k0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(),
      'k1111111-1111-4111-8111-11111111111a',
      'operator_adjustment', 'client-actor-userid-direct-ok-1', 'idem-actor-userid-direct-ok-1',
      null, '{}'::jsonb
    )
  $sql$),
  null,
  'direct inventory_events insert with a real actor remains allowed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'k1111111-1111-4111-8111-11111111111a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  pg_temp.error_of($sql$
    select public.record_inventory_event(
      'k0000000-0000-4000-8000-00000000000a',
      'k0000000-0000-4000-8000-000000000091',
      'adjustment', 1, 'g', now(), 'operator_adjustment',
      'client-actor-userid-rpc-ok-1', 'idem-actor-userid-rpc-ok-1',
      null, null, null, '{}'::jsonb
    )
  $sql$),
  null,
  'manager JWT can record an inventory event with auth.uid() actor attribution'
);

select is(
  (select actor_user_id from public.inventory_events
    where client_event_id = 'client-actor-userid-rpc-ok-1'),
  'k1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted RPC event keeps the authenticated actor_user_id'
);

reset role;

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'k1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after inventory history exists'
);

select is(
  (
    select count(*)
    from public.inventory_events
    where client_event_id = 'client-actor-userid-rpc-ok-1'
      and actor_user_id is null
  ),
  1::bigint,
  'account deletion anonymizes actor_user_id without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.inventory_events
    where client_event_id = 'client-actor-userid-rpc-ok-1'
      and quantity = 1
      and source = 'operator_adjustment'
  ),
  1::bigint,
  'account deletion preserves immutable inventory event business fields'
);

select * from finish();
rollback;
