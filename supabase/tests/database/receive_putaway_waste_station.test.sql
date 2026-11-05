-- Receive putaway + waste station attribution contracts.

begin;
select plan(8);

select has_function(
  'private',
  'apply_inventory_receive_putaway',
  array['uuid', 'uuid', 'uuid', 'numeric'],
  'receive putaway helper exists'
);
select has_function(
  'private',
  'apply_inventory_waste_station_deduction',
  array['uuid', 'uuid', 'uuid', 'numeric', 'numeric'],
  'waste station deduction helper exists'
);
select has_function(
  'public',
  'record_supplier_delivery',
  array['uuid', 'uuid', 'text', 'timestamptz', 'jsonb', 'numeric', 'text'],
  'record_supplier_delivery still exists'
);

select ok(
  pg_get_functiondef(
    'public.record_supplier_delivery(uuid,uuid,text,timestamptz,jsonb,numeric,text)'::regprocedure
  ) ~ 'storageLocationId',
  'delivery RPC reads optional per-line storageLocationId'
);
select ok(
  pg_get_functiondef(
    'public.record_supplier_delivery(uuid,uuid,text,timestamptz,jsonb,numeric,text)'::regprocedure
  ) ~ 'apply_inventory_receive_putaway',
  'delivery RPC applies putaway after a successful receive'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'apply_inventory_event_station_attribution'
  ),
  'station attribution trigger exists on inventory_events'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'enrich_inventory_event_station_metadata'
  ),
  'station metadata enrichment trigger exists'
);
select ok(
  pg_get_functiondef('private.apply_inventory_event_station_attribution()'::regprocedure)
    ~ 'supplier_delivery',
  'attribution trigger skips supplier_delivery receipts to avoid double-credit'
);

select finish();
rollback;
