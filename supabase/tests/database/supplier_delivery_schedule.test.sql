begin;
select plan(12);

select has_column('public', 'suppliers', 'delivery_days', 'delivery_days column exists');
select has_column('public', 'suppliers', 'order_cutoff_minutes', 'order_cutoff_minutes column exists');

select col_type_is('public', 'suppliers', 'delivery_days', 'smallint[]', 'delivery_days is smallint[]');
select col_type_is(
  'public',
  'suppliers',
  'order_cutoff_minutes',
  'smallint',
  'order_cutoff_minutes is smallint'
);

select col_not_null('public', 'suppliers', 'delivery_days', 'delivery_days is not null');
select col_is_null(
  'public',
  'suppliers',
  'order_cutoff_minutes',
  'order_cutoff_minutes remains nullable'
);

select col_default_is(
  'public',
  'suppliers',
  'delivery_days',
  '{}'::smallint[],
  'delivery_days defaults to empty'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'suppliers_delivery_days_check'
  ),
  'delivery_days check constraint exists'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'suppliers_order_cutoff_minutes_check'
  ),
  'order_cutoff_minutes check constraint exists'
);

select has_function(
  'public',
  'update_supplier_delivery_schedule',
  array['uuid', 'uuid', 'smallint[]', 'integer'],
  'update_supplier_delivery_schedule exists'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.update_supplier_delivery_schedule(uuid,uuid,smallint[],integer)',
    'EXECUTE'
  ),
  true,
  'authenticated can execute update_supplier_delivery_schedule'
);
select is(
  has_function_privilege(
    'anon',
    'public.update_supplier_delivery_schedule(uuid,uuid,smallint[],integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute update_supplier_delivery_schedule'
);

select * from finish();
rollback;
