begin;
select plan(5);

select has_column('public', 'inventory_items', 'safety_stock', 'safety_stock column exists');
select col_type_is('public', 'inventory_items', 'safety_stock', 'numeric', 'safety_stock is numeric');
select col_not_null('public', 'inventory_items', 'safety_stock', 'safety_stock is not null');
select col_default_is(
  'public',
  'inventory_items',
  'safety_stock',
  '0',
  'safety_stock defaults to 0'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_safety_stock_check'
  ),
  'safety_stock check constraint exists'
);

select * from finish();
rollback;
