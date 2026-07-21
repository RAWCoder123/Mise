-- Operational beta constraints.
-- These constraints harden Mise's tenant-owned operating data without adding new
-- product scope. Provider credentials, OAuth tokens, and raw setup import data
-- must stay out of client-readable public tables.

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_operational_values_check
    check (
      length(trim(item_name)) > 0 and
      length(trim(unit)) > 0 and
      length(trim(supplier_name)) > 0 and
      current_quantity >= 0 and
      par_level >= 0 and
      reorder_threshold >= 0 and
      estimated_unit_cost >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.purchase_recommendations
    add constraint purchase_recommendations_operational_values_check
    check (
      length(trim(item_name)) > 0 and
      length(trim(supplier_name)) > 0 and
      length(trim(unit)) > 0 and
      recommended_quantity >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.supplier_orders
    add constraint supplier_orders_operational_values_check
    check (
      length(trim(supplier_name)) > 0 and
      length(trim(order_message)) > 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.supplier_items
    add constraint supplier_items_operational_values_check
    check (
      length(trim(supplier_name)) > 0 and
      length(trim(item_name)) > 0 and
      length(trim(unit)) > 0 and
      estimated_unit_cost >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.purchase_orders
    add constraint purchase_orders_operational_values_check
    check (
      length(trim(supplier_name)) > 0 and
      subtotal_estimate >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pos_integrations
    add constraint pos_integrations_public_settings_no_secret_keys_check
    check (
      not (settings ?| array[
        'access_token',
        'refresh_token',
        'client_secret',
        'oauth_token',
        'api_key',
        'password',
        'service_role'
      ])
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.sales_imports
    add constraint sales_imports_public_metadata_no_secret_keys_check
    check (
      not (metadata ?| array[
        'access_token',
        'refresh_token',
        'client_secret',
        'oauth_token',
        'api_key',
        'password',
        'service_role',
        'missingSecret'
      ])
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.setup_attachments
    add constraint setup_attachments_metadata_only_check
    check (
      length(trim(label)) > 0 and
      metadata ? 'storage_status' and
      metadata->>'storage_status' = 'metadata_only'
    );
exception
  when duplicate_object then null;
end $$;
