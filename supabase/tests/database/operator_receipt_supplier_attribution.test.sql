begin;
select plan(5);

select has_function(
  'private',
  'validate_operator_receipt_supplier_attribution',
  'operator receipt supplier attribution validator exists'
);

select has_trigger(
  'public',
  'inventory_events',
  'validate_operator_receipt_supplier_attribution',
  'operator receipt supplier attribution trigger is installed'
);

select ok(
  pg_get_functiondef('private.validate_operator_receipt_supplier_attribution()'::regprocedure)
    like '%operator_receipt%',
  'validator scopes to operator_receipt source'
);

select ok(
  pg_get_functiondef('private.validate_operator_receipt_supplier_attribution()'::regprocedure)
    like '%Ad-hoc receipts require the item''s durable supplier identity.%',
  'validator rejects missing durable supplier attribution'
);

select ok(
  pg_get_functiondef('private.validate_operator_receipt_supplier_attribution()'::regprocedure)
    like '%Receipt supplier identity must match the inventory item supplier.%',
  'validator rejects mismatched supplier attribution'
);

select * from finish();
rollback;
