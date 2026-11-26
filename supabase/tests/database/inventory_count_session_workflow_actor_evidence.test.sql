create extension if not exists pgtap with schema extensions;

begin;

-- Plan derived by counting assertion call sites in this file:
--   grep -cE '^select (is|isnt|ok|matches|has_function)\(' inventory_count_session_workflow_actor_evidence.test.sql
-- No loops or conditional assertion paths. If pgTAP reports a different count,
-- that is a failure to investigate, not a number to edit.
select plan(11);

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
  ('d1111111-1111-4111-8111-11111111111a', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'count-session-workflow-actor-evidence-manager@mise.test',
   crypt('password', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());

insert into public.restaurants (id, name, cuisine_type, timezone) values
  ('d0000000-0000-4000-8000-00000000000a', 'Count Session Workflow Actor Evidence Kitchen', 'Cafe', 'UTC');

insert into public.restaurant_memberships (restaurant_id, user_id, role, status) values
  ('d0000000-0000-4000-8000-00000000000a', 'd1111111-1111-4111-8111-11111111111a', 'manager', 'active');

insert into public.suppliers (id, restaurant_id, display_name, normalized_name) values
  ('d0000000-0000-4000-8000-000000000090', 'd0000000-0000-4000-8000-00000000000a', 'Evidence Co', 'evidence co');

insert into public.inventory_items (
  id, restaurant_id, item_name, category, unit, current_quantity,
  par_level, reorder_threshold, estimated_unit_cost, supplier_id, supplier_name,
  canonical_unit, canonical_quantity_per_unit,
  canonical_unit_verification_status, canonical_unit_verified_at, canonical_unit_verified_by
) values
  (
    'd0000000-0000-4000-8000-000000000091', 'd0000000-0000-4000-8000-00000000000a',
    'Onions', 'Produce', 'lb', 10, 20, 5, 1.5,
    'd0000000-0000-4000-8000-000000000090', 'Evidence Co',
    'g', 453.592, 'verified', now(), 'd1111111-1111-4111-8111-11111111111a'
  );

select has_function(
  'private',
  'enforce_inventory_count_session_workflow_actor_evidence',
  'inventory count session workflow actor evidence guard exists'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at, submitted_at, note
    ) values (
      'd0000000-0000-4000-8000-00000000000a',
      'submitted',
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      now(),
      'null submitter probe'
    )
  $sql$),
  'Inventory count session submitter is required',
  'direct inventory_count_sessions insert cannot mint submitted status without submitted_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at, approved_at, note
    ) values (
      'd0000000-0000-4000-8000-00000000000a',
      'approved',
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      now(),
      'null approver probe'
    )
  $sql$),
  'Inventory count session approver is required',
  'direct inventory_count_sessions insert cannot mint approved status without approved_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      restaurant_id, status, started_by, started_at, cancelled_at, note
    ) values (
      'd0000000-0000-4000-8000-00000000000a',
      'cancelled',
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      now(),
      'null canceller probe'
    )
  $sql$),
  'Inventory count session canceller is required',
  'direct inventory_count_sessions insert cannot mint cancelled status without cancelled_by'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at, approved_by, approved_at, note
    ) values (
      'd0000000-0000-4000-8000-0000000000ab',
      'd0000000-0000-4000-8000-00000000000a',
      'approved',
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      'attributed approver probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert with approved_by remains allowed'
);

select is(
  pg_temp.error_of($sql$
    insert into public.inventory_count_sessions (
      id, restaurant_id, status, started_by, started_at, cancelled_by, cancelled_at, note
    ) values (
      'd0000000-0000-4000-8000-0000000000aa',
      'd0000000-0000-4000-8000-00000000000a',
      'cancelled',
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      'd1111111-1111-4111-8111-11111111111a',
      now(),
      'attributed canceller probe'
    )
  $sql$),
  null,
  'direct inventory_count_sessions insert with cancelled_by remains allowed'
);

select is(
  pg_temp.error_of($sql$
    select private.service_begin_inventory_count_session(
      'd1111111-1111-4111-8111-11111111111a',
      'd0000000-0000-4000-8000-00000000000a',
      'rpc workflow actor probe'
    )
  $sql$),
  null,
  'hosted begin RPC can open an in_progress count session without workflow actors'
);

select is(
  (
    select started_by
    from public.inventory_count_sessions
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and status = 'in_progress'
      and note = 'rpc workflow actor probe'
  ),
  'd1111111-1111-4111-8111-11111111111a'::uuid,
  'accepted begin RPC keeps the authenticated started_by'
);

select is(
  pg_temp.error_of($sql$
    delete from auth.users
    where id = 'd1111111-1111-4111-8111-11111111111a'
  $sql$),
  null,
  'account deletion remains allowed after count-session history exists'
);

select is(
  (
    select count(*)
    from public.inventory_count_sessions
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and note = 'attributed canceller probe'
      and cancelled_by is null
      and started_by is null
  ),
  1::bigint,
  'account deletion anonymizes workflow actors without rewriting business fields'
);

select is(
  (
    select count(*)
    from public.inventory_count_sessions
    where restaurant_id = 'd0000000-0000-4000-8000-00000000000a'
      and note = 'attributed canceller probe'
      and status = 'cancelled'
  ),
  1::bigint,
  'account deletion preserves immutable count-session business fields'
);

select * from finish();
rollback;
