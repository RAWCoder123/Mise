-- pgTAP coverage for complete_supplier_order_accepting_short.

begin;
select plan(3);

select has_function(
  'public',
  'complete_supplier_order_accepting_short',
  array['uuid', 'uuid'],
  'short-close RPC exists'
);

select function_privs_are(
  'public',
  'complete_supplier_order_accepting_short',
  array['uuid', 'uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated may execute short-close'
);

select function_privs_are(
  'public',
  'complete_supplier_order_accepting_short',
  array['uuid', 'uuid'],
  'anon',
  array[]::text[],
  'anon cannot execute short-close'
);

select * from finish();
rollback;
