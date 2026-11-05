begin;
select plan(10);

select has_column('public', 'inventory_items', 'lead_time_days', 'lead_time_days column exists');
select has_column('public', 'inventory_items', 'minimum_order_quantity', 'minimum_order_quantity column exists');

select col_type_is('public', 'inventory_items', 'lead_time_days', 'integer', 'lead_time_days is integer');
select col_type_is(
  'public',
  'inventory_items',
  'minimum_order_quantity',
  'numeric',
  'minimum_order_quantity is numeric'
);

select col_not_null('public', 'inventory_items', 'lead_time_days', 'lead_time_days is not null');
select col_not_null(
  'public',
  'inventory_items',
  'minimum_order_quantity',
  'minimum_order_quantity is not null'
);

select col_default_is(
  'public',
  'inventory_items',
  'lead_time_days',
  '0',
  'lead_time_days defaults to 0'
);
select col_default_is(
  'public',
  'inventory_items',
  'minimum_order_quantity',
  '0',
  'minimum_order_quantity defaults to 0'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_lead_time_days_check'
  ),
  'lead_time_days check constraint exists'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_minimum_order_quantity_check'
  ),
  'minimum_order_quantity check constraint exists'
);

select * from finish();
rollback;
