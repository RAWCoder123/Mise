create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_count_session_started_by_evidence.test.sql
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
  ('c1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'count-session-started-by-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('c0000000-0000-4000-8000-00000000000a', 'Count Session Started By Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('c0000000-0000-4000-8000-00000000000a', 'c1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('c0000000-0000-4000-8000-000000000090', 'c0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'c0000000-0000-4000-8000-000000000091', 'c0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'c0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'c1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_count_session_started_by_evidence',
  'inventory count session started_by evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at, note
    ) values (
      'c0000000-0000-4000-8000-00000000000a',
      'cancelled',
      null,
      now(),
      'null starter probe'
    )
  $sql$),
  'Inventory count session starter is required',
  'direct inventory_count_sessions insert cannot mint an unattributable null started_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at, cancelled_at, note
    ) values (
      'c0000000-0000-4000-8000-0000000000aa',
      'c0000000-0000-4000-8000-00000000000a',
      'cancelled',
      'c1111111-1111-4111-8111-11111111111a',
      now(),
      now(),
      'attributed starter probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert with a real started_by remains allowed'
);

select is(
  pg_temp.error_of($sql$
    select private.service_begin_inventory_count_session(
      'c1111111-1111-4111-8111-11111111111a',
      'c0000000-0000-4000-8000-00000000000a',
      'rpc starter probe'
    )
  $sql$),
  null,
  'hosted begin RPC can open a count session with actor starter attribution'
);

select is(
  (
    select started_by
    from public.inventory_count_sessions
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and status = 'in_progress'
      and note = 'rpc starter probe'
  ),
  'c1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted begin RPC keeps the authenticated started_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'c1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after count-session history exists'
);

select is(
  (
    select count(*)
    from public.inventory_count_sessions
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and note = 'rpc starter probe'
      and started_by is null
  ),
  1::bigint,
  'account deletion anonymizes started_by without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.inventory_count_sessions
    where restaurant_id = 'c0000000-0000-4000-8000-00000000000a'
      and note = 'rpc starter probe'
      and status = 'in_progress'
  ),
  1::bigint,
  'account deletion preserves immutable count-session business fields'
);

select * from finish();
rollback;
