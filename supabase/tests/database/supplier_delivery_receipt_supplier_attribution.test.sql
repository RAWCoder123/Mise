begin;
select plan(5);

select has_function(
  'private',
  'stamp_supplier_delivery_receipt_supplier_attribution',
  'supplier delivery receipt supplier attribution stamper exists'
);

select has_trigger(
  'public',
  'inventory_events',
  'stamp_supplier_delivery_receipt_supplier_attribution',
  'supplier delivery receipt supplier attribution trigger is installed'
);

select ok(
  pg_get_functiondef('private.stamp_supplier_delivery_receipt_supplier_attribution()'::regprocedure)
    like '%supplier_delivery%',
  'stamper scopes to supplier_delivery source'
);

select ok(
  pg_get_functiondef('private.stamp_supplier_delivery_receipt_supplier_attribution()'::regprocedure)
    like '%Supplier delivery receipts require the order''s durable supplier identity.%',
  'stamper rejects missing durable order supplier attribution'
);

select ok(
  pg_get_functiondef('private.stamp_supplier_delivery_receipt_supplier_attribution()'::regprocedure)
    like '%Supplier delivery receipt identity must match the supplier order.%',
  'stamper rejects mismatched supplier attribution'
);

select * from finish();
rollback;
