begin;
select plan(4);

select has_function(
  'private',
  'validate_inventory_event_receipt_expires_on',
  'receipt expires_on validator exists'
);

select has_trigger(
  'public',
  'inventory_events',
  'validate_inventory_event_receipt_expires_on',
  'receipt expires_on trigger is installed'
);

select ok(
  pg_get_functiondef('private.validate_inventory_event_receipt_expires_on()'::regprocedure)
    like '%expires_on%',
  'validator inspects metadata expires_on'
);

select ok(
  pg_get_functiondef('private.validate_inventory_event_receipt_expires_on()'::regprocedure)
    like '%Use-by dates can only be recorded on receipts%',
  'validator rejects expires_on on non-receipt events'
);

select * from finish();
rollback;
