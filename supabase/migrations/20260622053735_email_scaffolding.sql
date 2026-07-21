-- Restaurant-owned email readiness scaffolding.
-- These tables store connection state and supplier recipient metadata only.
-- OAuth refresh/access tokens and Google client secrets must live in backend-only
-- Edge Function/Vault storage, never in Expo public env vars or client-readable rows.

create table if not exists public.restaurant_email_connections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  provider text not null default 'gmail' check (provider in ('gmail')),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'needs_reauth', 'restricted')),
  sender_email text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, provider)
);

create table if not exists public.supplier_recipients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, supplier_name, email)
);

comment on table public.restaurant_email_connections is
  'Client-readable restaurant email connection status only. Never store Gmail OAuth tokens, refresh tokens, Google client secrets, or SMTP passwords here.';

comment on column public.restaurant_email_connections.sender_email is
  'Verified sender email for display and readiness checks. Not an OAuth token or password.';

comment on table public.supplier_recipients is
  'Restaurant-scoped supplier recipient email metadata used to prepare supplier email payloads.';

drop trigger if exists set_restaurant_email_connections_updated_at on public.restaurant_email_connections;
create trigger set_restaurant_email_connections_updated_at
before update on public.restaurant_email_connections
for each row execute function public.set_updated_at();

drop trigger if exists set_supplier_recipients_updated_at on public.supplier_recipients;
create trigger set_supplier_recipients_updated_at
before update on public.supplier_recipients
for each row execute function public.set_updated_at();

alter table public.restaurant_email_connections enable row level security;
alter table public.supplier_recipients enable row level security;

drop policy if exists "Members can read restaurant email connections" on public.restaurant_email_connections;
drop policy if exists "Owners and admins can insert restaurant email connections" on public.restaurant_email_connections;
drop policy if exists "Owners and admins can update restaurant email connections" on public.restaurant_email_connections;
drop policy if exists "Owners and admins can delete restaurant email connections" on public.restaurant_email_connections;

create policy "Members can read restaurant email connections"
on public.restaurant_email_connections for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Owners and admins can insert restaurant email connections"
on public.restaurant_email_connections for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can update restaurant email connections"
on public.restaurant_email_connections for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

create policy "Owners and admins can delete restaurant email connections"
on public.restaurant_email_connections for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

drop policy if exists "Members can read supplier recipients" on public.supplier_recipients;
drop policy if exists "Managers can insert supplier recipients" on public.supplier_recipients;
drop policy if exists "Managers can update supplier recipients" on public.supplier_recipients;
drop policy if exists "Owners and admins can delete supplier recipients" on public.supplier_recipients;

create policy "Members can read supplier recipients"
on public.supplier_recipients for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert supplier recipients"
on public.supplier_recipients for insert to authenticated
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Managers can update supplier recipients"
on public.supplier_recipients for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete supplier recipients"
on public.supplier_recipients for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

revoke all on public.restaurant_email_connections from anon;
revoke all on public.supplier_recipients from anon;
grant select, insert, update, delete on public.restaurant_email_connections to authenticated;
grant select, insert, update, delete on public.supplier_recipients to authenticated;

create index if not exists idx_restaurant_email_connections_restaurant_id
on public.restaurant_email_connections(restaurant_id);

create index if not exists idx_supplier_recipients_restaurant_id
on public.supplier_recipients(restaurant_id);

create index if not exists idx_supplier_recipients_restaurant_supplier
on public.supplier_recipients(restaurant_id, supplier_name);
