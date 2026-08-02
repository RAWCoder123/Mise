-- Legacy reference snapshot. DO NOT apply this file to beta/staging/production.
-- Apply supabase/migrations/*.sql in lexicographic order instead.
-- This snapshot intentionally omits later tables such as inventory_movements,
-- inventory_count_sessions, account_deletion_requests, Gmail/outreach objects,
-- and user-scoped Edge firewall policies for account-onboarding /
-- request-account-deletion (see migrations through 20260802020000_*).
-- SCHEMA_SQL_IS_LEGACY_SNAPSHOT=1

create extension if not exists "pgcrypto";
create schema if not exists private;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  cuisine_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'manager', 'staff')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  sale_date date not null,
  item_name text not null,
  category text not null,
  quantity_sold numeric not null default 0,
  gross_sales numeric not null default 0,
  net_sales numeric not null default 0,
  source_pos text not null default 'Demo POS',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_name text not null,
  category text not null,
  unit text not null,
  current_quantity numeric not null default 0,
  par_level numeric not null default 0,
  reorder_threshold numeric not null default 0,
  estimated_unit_cost numeric not null default 0,
  supplier_name text not null,
  last_updated timestamptz not null default now()
);

create table if not exists public.menu_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  menu_item_name text not null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_used_per_sale numeric not null default 0 check (quantity_used_per_sale >= 0),
  unit text not null
);

create table if not exists public.purchase_recommendations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  item_name text not null,
  supplier_name text not null,
  recommended_quantity numeric not null default 0,
  unit text not null,
  reason text not null,
  urgency text not null check (urgency in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed', 'ordered')),
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_name text not null,
  order_message text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'completed')),
  delivery_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  insight_type text not null check (insight_type in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')),
  title text not null,
  description text not null,
  recommended_action text not null,
  severity text not null check (severity in ('info', 'warning', 'urgent')),
  created_at timestamptz not null default now()
);

alter table public.insights
  add column if not exists why_it_matters text;

do $$
begin
  alter table public.menu_item_ingredients
    add constraint menu_item_ingredients_quantity_nonnegative check (quantity_used_per_sale >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pos_sales
    add constraint pos_sales_amounts_nonnegative
    check (quantity_sold >= 0 and gross_sales >= 0 and net_sales >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_amounts_nonnegative
    check (
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
    add constraint purchase_recommendations_quantity_nonnegative check (recommended_quantity >= 0);
exception
  when duplicate_object then null;
end $$;

create index if not exists pos_sales_restaurant_date_idx on public.pos_sales (restaurant_id, sale_date);
create index if not exists pos_sales_restaurant_item_date_idx on public.pos_sales (restaurant_id, item_name, sale_date desc);
create index if not exists inventory_items_restaurant_idx on public.inventory_items (restaurant_id);
create index if not exists inventory_items_restaurant_supplier_idx on public.inventory_items (restaurant_id, supplier_name);
create index if not exists menu_item_ingredients_restaurant_menu_idx on public.menu_item_ingredients (restaurant_id, menu_item_name);
create index if not exists purchase_recommendations_restaurant_status_idx on public.purchase_recommendations (restaurant_id, status);
create index if not exists supplier_orders_restaurant_status_idx on public.supplier_orders (restaurant_id, status);
create index if not exists insights_restaurant_created_idx on public.insights (restaurant_id, created_at desc);
create index if not exists insights_restaurant_severity_idx on public.insights (restaurant_id, severity, created_at desc);
create index if not exists idx_restaurant_memberships_user_id
  on public.restaurant_memberships(user_id);
create index if not exists idx_restaurant_memberships_restaurant_id
  on public.restaurant_memberships(restaurant_id);
create index if not exists idx_inventory_items_restaurant_id
  on public.inventory_items(restaurant_id);
create index if not exists idx_pos_sales_restaurant_id_sale_date
  on public.pos_sales(restaurant_id, sale_date);
create index if not exists idx_purchase_recommendations_restaurant_id
  on public.purchase_recommendations(restaurant_id);
create index if not exists idx_supplier_orders_restaurant_id
  on public.supplier_orders(restaurant_id);
create index if not exists idx_insights_restaurant_id
  on public.insights(restaurant_id);
create unique index if not exists menu_item_ingredients_unique_mapping_idx
  on public.menu_item_ingredients (restaurant_id, menu_item_name, inventory_item_id);
create unique index if not exists purchase_recommendations_pending_item_idx
  on public.purchase_recommendations (restaurant_id, inventory_item_id)
  where status = 'pending';
create unique index if not exists supplier_orders_draft_supplier_idx
  on public.supplier_orders (restaurant_id, supplier_name)
  where status = 'draft';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_restaurant_memberships_updated_at on public.restaurant_memberships;
create trigger set_restaurant_memberships_updated_at
before update on public.restaurant_memberships
for each row execute function public.set_updated_at();

create or replace function private.is_restaurant_member(target_restaurant_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships rm
    where auth.uid() is not null
      and rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.status = 'active'
  );
$$;

create or replace function private.has_restaurant_role(
  target_restaurant_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurant_memberships rm
    where auth.uid() is not null
      and rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.status = 'active'
      and rm.role = any(allowed_roles)
  );
$$;

create or replace function private.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_restaurant public.restaurants;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(restaurant_name), '') is null then
    raise exception 'Restaurant name is required';
  end if;

  insert into public.restaurants (name, cuisine_type)
  values (nullif(trim(restaurant_name), ''), nullif(trim(restaurant_cuisine_type), ''))
  returning * into new_restaurant;

  insert into public.restaurant_memberships (
    restaurant_id,
    user_id,
    role,
    status
  )
  values (
    new_restaurant.id,
    auth.uid(),
    'owner',
    'active'
  );

  return new_restaurant;
end;
$$;

create or replace function public.create_restaurant_with_owner(
  restaurant_name text,
  restaurant_cuisine_type text default null
)
returns public.restaurants
language sql
security invoker
set search_path = ''
as $$
  select private.create_restaurant_with_owner(restaurant_name, restaurant_cuisine_type);
$$;

revoke all on function private.is_restaurant_member(uuid) from public, anon;
revoke all on function private.has_restaurant_role(uuid, text[]) from public, anon;
revoke all on function private.create_restaurant_with_owner(text, text) from public, anon;
revoke all on function public.create_restaurant_with_owner(text, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_restaurant_member(uuid) to authenticated;
grant execute on function private.has_restaurant_role(uuid, text[]) to authenticated;
grant execute on function private.create_restaurant_with_owner(text, text) to authenticated;
grant execute on function public.create_restaurant_with_owner(text, text) to authenticated;

alter table public.restaurants enable row level security;
alter table public.users enable row level security;
alter table public.restaurant_memberships enable row level security;
alter table public.pos_sales enable row level security;
alter table public.inventory_items enable row level security;
alter table public.menu_item_ingredients enable row level security;
alter table public.purchase_recommendations enable row level security;
alter table public.supplier_orders enable row level security;
alter table public.insights enable row level security;

create policy "Members can read their restaurants"
on public.restaurants
for select
to authenticated
using (private.is_restaurant_member(id));

create policy "Owners and admins can update restaurant profile"
on public.restaurants
for update
to authenticated
using (private.has_restaurant_role(id, array['owner', 'admin']))
with check (private.has_restaurant_role(id, array['owner', 'admin']));

create policy "Users can read own profile"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read own memberships"
on public.restaurant_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or private.has_restaurant_role(restaurant_id, array['owner', 'admin'])
);

create policy "Owners and admins can invite restaurant members"
on public.restaurant_memberships
for insert
to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can update restaurant members"
on public.restaurant_memberships
for update
to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can delete restaurant members"
on public.restaurant_memberships
for delete
to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read sales"
on public.pos_sales for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert sales"
on public.pos_sales for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update sales"
on public.pos_sales for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete sales"
on public.pos_sales for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read inventory"
on public.inventory_items for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert inventory"
on public.inventory_items for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update inventory"
on public.inventory_items for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete inventory"
on public.inventory_items for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read menu mappings"
on public.menu_item_ingredients for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert menu mappings"
on public.menu_item_ingredients for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update menu mappings"
on public.menu_item_ingredients for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete menu mappings"
on public.menu_item_ingredients for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read recommendations"
on public.purchase_recommendations for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert recommendations"
on public.purchase_recommendations for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update recommendations"
on public.purchase_recommendations for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete recommendations"
on public.purchase_recommendations for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read supplier orders"
on public.supplier_orders for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert supplier orders"
on public.supplier_orders for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update supplier orders"
on public.supplier_orders for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete supplier orders"
on public.supplier_orders for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Members can read insights"
on public.insights for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert insights"
on public.insights for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update insights"
on public.insights for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete insights"
on public.insights for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

grant usage on schema public to authenticated;
grant select, update on public.restaurants to authenticated;
grant select on public.users to authenticated;
grant update (name) on public.users to authenticated;
grant select, insert, update, delete on public.restaurant_memberships to authenticated;
grant select, insert, update, delete on public.pos_sales to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.menu_item_ingredients to authenticated;
grant select, insert, update, delete on public.purchase_recommendations to authenticated;
grant select, insert, update, delete on public.supplier_orders to authenticated;
grant select, insert, update, delete on public.insights to authenticated;
