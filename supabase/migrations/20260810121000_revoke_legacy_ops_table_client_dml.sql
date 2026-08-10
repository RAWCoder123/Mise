-- Legacy ops tables remain readable for export/demo surfaces, but authenticated
-- clients must not Data-API forge imports, supplier catalog rows, or purchase
-- orders. Writes stay with service_role / Edge / guarded RPCs.

drop policy if exists "Managers can insert sales imports" on public.sales_imports;
drop policy if exists "Managers can update sales imports" on public.sales_imports;
drop policy if exists "Owners and admins can delete sales imports" on public.sales_imports;

drop policy if exists "Managers can insert supplier items" on public.supplier_items;
drop policy if exists "Managers can update supplier items" on public.supplier_items;
drop policy if exists "Owners and admins can delete supplier items" on public.supplier_items;

drop policy if exists "Managers can insert purchase orders" on public.purchase_orders;
drop policy if exists "Managers can update purchase orders" on public.purchase_orders;
drop policy if exists "Owners and admins can delete purchase orders" on public.purchase_orders;

revoke insert, update, delete on public.sales_imports from authenticated;
revoke insert, update, delete on public.supplier_items from authenticated;
revoke insert, update, delete on public.purchase_orders from authenticated;

grant select on public.sales_imports to authenticated;
grant select on public.supplier_items to authenticated;
grant select on public.purchase_orders to authenticated;

grant select, insert, update, delete on public.sales_imports to service_role;
grant select, insert, update, delete on public.supplier_items to service_role;
grant select, insert, update, delete on public.purchase_orders to service_role;
