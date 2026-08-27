-- Storage locations + ledgered station transfers.

begin;
select plan(12);

select has_table('public', 'storage_locations', 'storage_locations exists');
select has_table('public', 'inventory_location_balances', 'inventory_location_balances exists');

select is(
  has_table_privilege('authenticated', 'public.storage_locations', 'INSERT'),
  false,
  'authenticated cannot insert storage_locations directly'
);
select is(
  has_table_privilege('authenticated', 'public.inventory_location_balances', 'UPDATE'),
  false,
  'authenticated cannot update location balances directly'
);

select has_function(
  'public',
  'transfer_inventory',
  array['uuid', 'uuid', 'uuid', 'uuid', 'numeric', 'text'],
  'transfer_inventory RPC exists'
);
select has_function(
  'public',
  'create_storage_location',
  array['uuid', 'text'],
  'create_storage_location RPC exists'
);

select ok(
  pg_get_functiondef('public.transfer_inventory(uuid,uuid,uuid,uuid,numeric,text)'::regprocedure)
    ~ 'array\[''owner'', ''admin'', ''manager'', ''staff''\]',
  'transfer_inventory allows staff+'
);
select ok(
  pg_get_functiondef('public.create_storage_location(uuid,text)'::regprocedure)
    ~ 'array\[''owner'', ''admin'', ''manager''\]',
  'create_storage_location stays manager+'
);
select ok(
  pg_get_functiondef('private.stamp_inventory_event_authority_projection()'::regprocedure)
    ~ 'when new\.event_type = ''transfer'' then prior_quantity',
  'authority stamp treats transfer as on-hand no-op'
);
select ok(
  pg_get_functiondef('private.enforce_transfer_event_invariants()'::regprocedure)
    ~ 'quantity 0',
  'transfer ledger rows must use quantity 0'
);

select is(
  (select proacl::text like '%authenticated=X%'
     and proacl::text not like '%service_role=X%'
   from pg_proc
   where oid = 'public.transfer_inventory(uuid,uuid,uuid,uuid,numeric,text)'::regprocedure),
  true,
  'transfer_inventory execute is authenticated-only'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'activity_events_event_type_check'
      and pg_get_constraintdef(oid) like '%inventory_transfer_recorded%'
  ),
  'activity allowlist includes inventory_transfer_recorded'
);

select finish();
rollback;
