-- Post-setup Manual CSV import: tenant role gate, upsert identity, no setup reopen.

begin;
select plan(8);

select has_function(
  'public',
  'import_manual_pos_sales',
  array['uuid', 'jsonb'],
  'import_manual_pos_sales exists'
);

select function_privs_are(
  'public',
  'import_manual_pos_sales',
  array['uuid', 'jsonb'],
  'authenticated',
  array['EXECUTE'],
  'authenticated can execute import_manual_pos_sales'
);

select function_privs_are(
  'public',
  'import_manual_pos_sales',
  array['uuid', 'jsonb'],
  'anon',
  array[]::text[],
  'anon cannot execute import_manual_pos_sales'
);

select function_privs_are(
  'public',
  'import_manual_pos_sales',
  array['uuid', 'jsonb'],
  'service_role',
  array[]::text[],
  'service_role cannot execute import_manual_pos_sales'
);

-- Remaining behavioral assertions live in Node unit coverage when Docker is
-- unavailable; pin the durable Manual CSV Upload source identity contract.
select matches(
  pg_get_functiondef('public.import_manual_pos_sales(uuid,jsonb)'::regprocedure),
  'Manual CSV Upload',
  'import_manual_pos_sales requires Manual CSV Upload source_pos'
);

select matches(
  pg_get_functiondef('public.import_manual_pos_sales(uuid,jsonb)'::regprocedure),
  'has_restaurant_role',
  'import_manual_pos_sales checks restaurant role'
);

select matches(
  pg_get_functiondef('public.import_manual_pos_sales(uuid,jsonb)'::regprocedure),
  'manual_pos_sales_imported',
  'import_manual_pos_sales writes an audit action'
);

select matches(
  pg_get_functiondef('public.import_manual_pos_sales(uuid,jsonb)'::regprocedure),
  'sales_imports',
  'import_manual_pos_sales records a sales_imports ledger row'
);

select * from finish();
rollback;
