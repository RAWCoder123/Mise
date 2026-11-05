begin;
select plan(5);

select has_column('public', 'inventory_items', 'shelf_life_days', 'shelf_life_days column exists');
select col_type_is('public', 'inventory_items', 'shelf_life_days', 'integer', 'shelf_life_days is integer');
select col_not_null('public', 'inventory_items', 'shelf_life_days', 'shelf_life_days is not null');
select col_default_is(
  'public',
  'inventory_items',
  'shelf_life_days',
  '0',
  'shelf_life_days defaults to 0'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_shelf_life_days_check'
  ),
  'shelf_life_days check constraint exists'
);

select * from finish();
rollback;
