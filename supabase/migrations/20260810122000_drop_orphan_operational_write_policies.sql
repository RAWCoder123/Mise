-- Authenticated DML grants on these tables were already revoked. Residual
-- INSERT/UPDATE/DELETE RLS policies are orphan authority surfaces: any future
-- grant regression would re-open direct Data API writes. Drop them so SELECT
-- membership policies are the only remaining authenticated policies.

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
