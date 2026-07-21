-- Align final table constraints with the strict setup/edit RPC contracts. A
-- zero inventory count remains valid; a persisted sale or recipe consumption
-- baseline must represent a positive operational event.

alter table public.menu_item_ingredients
  drop constraint if exists menu_item_ingredients_quantity_used_per_sale_check;
alter table public.menu_item_ingredients
  add constraint menu_item_ingredients_quantity_used_per_sale_check check (
    quantity_used_per_sale > 0 and quantity_used_per_sale <= 10000
  );

alter table public.pos_sales
  drop constraint if exists pos_sales_operational_values_check;
alter table public.pos_sales
  add constraint pos_sales_operational_values_check check (
    length(trim(item_name)) between 1 and 200 and
    length(trim(category)) between 1 and 120 and
    quantity_sold > 0 and quantity_sold <= 100000 and
    gross_sales between 0 and 10000000 and
    net_sales between 0 and 10000000
  );
