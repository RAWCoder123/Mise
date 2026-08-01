-- Drop residual authenticated write RLS policies on operational tables whose
-- mutations are service/Edge owned. Table DML grants were already revoked, so
-- the Data API cannot write today; leaving these policies would reopen
-- ledger-bypassing direct writes if grants ever regress.

drop policy if exists "Managers can insert inventory" on public.inventory_items;
drop policy if exists "Managers can update inventory" on public.inventory_items;
drop policy if exists "Owners and admins can delete inventory" on public.inventory_items;

drop policy if exists "Managers can insert menu mappings" on public.menu_item_ingredients;
drop policy if exists "Managers can update menu mappings" on public.menu_item_ingredients;
drop policy if exists "Owners and admins can delete menu mappings" on public.menu_item_ingredients;

drop policy if exists "Managers can insert sales" on public.pos_sales;
drop policy if exists "Managers can update sales" on public.pos_sales;
drop policy if exists "Owners and admins can delete sales" on public.pos_sales;

drop policy if exists "Managers can insert setup attachments" on public.setup_attachments;
drop policy if exists "Managers can update setup attachments" on public.setup_attachments;
drop policy if exists "Owners and admins can delete setup attachments" on public.setup_attachments;

comment on table public.inventory_items is
  'Inventory baselines and quantities. Authenticated clients have SELECT only; quantity and catalog mutations are service/Edge owned ledger workflows.';

comment on table public.menu_item_ingredients is
  'Recipe baselines mapping menu items to ingredients. Authenticated clients have SELECT only; mutations are service/Edge owned.';

comment on table public.pos_sales is
  'Normalized POS/CSV sales rows. Authenticated clients have SELECT only; ingestion and corrections are service/Edge owned.';

comment on table public.setup_attachments is
  'Setup import attachment metadata. Authenticated clients have SELECT only; mutations are service/Edge owned setup workflows.';
