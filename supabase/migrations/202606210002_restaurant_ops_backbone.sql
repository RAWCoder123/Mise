alter table public.restaurants
  add column if not exists brand_color text not null default '#EF3F27',
  add column if not exists accent_color text not null default '#EF3F27',
  add column if not exists logo_url text,
  add column if not exists service_style text not null default 'fast_casual',
  add column if not exists timezone text not null default 'America/New_York',
  add column if not exists currency text not null default 'USD',
  add column if not exists operational_profile jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.restaurants
    add constraint restaurants_brand_color_check check (brand_color ~ '^#[0-9A-Fa-f]{6}$');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.restaurants
    add constraint restaurants_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.restaurants
    add constraint restaurants_service_style_check check (
      service_style in ('quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen')
    );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.pos_integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null check (provider in ('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo')),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'paused', 'error')),
  external_location_id text,
  last_sync_at timestamptz,
  sync_cursor text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

create table if not exists public.sales_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  pos_integration_id uuid references public.pos_integrations(id) on delete set null,
  import_type text not null check (import_type in ('pos_sync', 'csv_upload', 'manual_adjustment')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  source_file_name text,
  records_processed integer not null default 0 check (records_processed >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

create table if not exists public.supplier_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_name text not null,
  supplier_sku text,
  item_name text not null,
  unit text not null,
  pack_size text,
  estimated_unit_cost numeric not null default 0 check (estimated_unit_cost >= 0),
  preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, supplier_name, item_name, unit)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_name text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'received', 'cancelled')),
  order_payload jsonb not null default '{}'::jsonb,
  subtotal_estimate numeric not null default 0 check (subtotal_estimate >= 0),
  expected_delivery_date date,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  source text not null default 'rules_engine' check (source in ('openai_structured_output', 'rules_engine', 'operator_note')),
  schema_version text not null default 'mise.ai_insight.v1',
  output jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'generated' check (status in ('generated', 'reviewed', 'dismissed', 'applied')),
  generated_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_pos_integrations_updated_at on public.pos_integrations;
create trigger set_pos_integrations_updated_at
before update on public.pos_integrations
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_items_updated_at on public.supplier_items;
create trigger set_supplier_items_updated_at
before update on public.supplier_items
for each row execute function public.set_updated_at();

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

alter table public.pos_integrations enable row level security;
alter table public.sales_imports enable row level security;
alter table public.supplier_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.ai_insights enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "Members can read pos integrations" on public.pos_integrations;
drop policy if exists "Owners and admins can insert pos integrations" on public.pos_integrations;
drop policy if exists "Owners and admins can update pos integrations" on public.pos_integrations;
drop policy if exists "Owners and admins can delete pos integrations" on public.pos_integrations;

create policy "Members can read pos integrations"
on public.pos_integrations for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Owners and admins can insert pos integrations"
on public.pos_integrations for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can update pos integrations"
on public.pos_integrations for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can delete pos integrations"
on public.pos_integrations for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Members can read sales imports" on public.sales_imports;
drop policy if exists "Managers can insert sales imports" on public.sales_imports;
drop policy if exists "Managers can update sales imports" on public.sales_imports;
drop policy if exists "Owners and admins can delete sales imports" on public.sales_imports;

create policy "Members can read sales imports"
on public.sales_imports for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert sales imports"
on public.sales_imports for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update sales imports"
on public.sales_imports for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete sales imports"
on public.sales_imports for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Members can read supplier items" on public.supplier_items;
drop policy if exists "Managers can insert supplier items" on public.supplier_items;
drop policy if exists "Managers can update supplier items" on public.supplier_items;
drop policy if exists "Owners and admins can delete supplier items" on public.supplier_items;

create policy "Members can read supplier items"
on public.supplier_items for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert supplier items"
on public.supplier_items for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update supplier items"
on public.supplier_items for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete supplier items"
on public.supplier_items for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Members can read purchase orders" on public.purchase_orders;
drop policy if exists "Managers can insert purchase orders" on public.purchase_orders;
drop policy if exists "Managers can update purchase orders" on public.purchase_orders;
drop policy if exists "Owners and admins can delete purchase orders" on public.purchase_orders;

create policy "Members can read purchase orders"
on public.purchase_orders for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert purchase orders"
on public.purchase_orders for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update purchase orders"
on public.purchase_orders for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete purchase orders"
on public.purchase_orders for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Members can read ai insights" on public.ai_insights;
drop policy if exists "Managers can insert ai insights" on public.ai_insights;
drop policy if exists "Managers can update ai insights" on public.ai_insights;
drop policy if exists "Owners and admins can delete ai insights" on public.ai_insights;

create policy "Members can read ai insights"
on public.ai_insights for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert ai insights"
on public.ai_insights for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update ai insights"
on public.ai_insights for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete ai insights"
on public.ai_insights for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Owners and admins can read audit logs" on public.audit_logs;
drop policy if exists "Managers can insert audit logs" on public.audit_logs;

create policy "Owners and admins can read audit logs"
on public.audit_logs for select to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Managers can insert audit logs"
on public.audit_logs for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

grant select, insert, update, delete on public.pos_integrations to authenticated;
grant select, insert, update, delete on public.sales_imports to authenticated;
grant select, insert, update, delete on public.supplier_items to authenticated;
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.ai_insights to authenticated;
grant select, insert on public.audit_logs to authenticated;

create index if not exists idx_pos_integrations_restaurant_id
on public.pos_integrations(restaurant_id);

create index if not exists idx_sales_imports_restaurant_id_imported_at
on public.sales_imports(restaurant_id, imported_at desc);

create index if not exists idx_supplier_items_restaurant_id_supplier
on public.supplier_items(restaurant_id, supplier_name);

create index if not exists idx_purchase_orders_restaurant_id_status
on public.purchase_orders(restaurant_id, status);

create index if not exists idx_ai_insights_restaurant_id_created_at
on public.ai_insights(restaurant_id, created_at desc);

create index if not exists idx_audit_logs_restaurant_id_created_at
on public.audit_logs(restaurant_id, created_at desc);
