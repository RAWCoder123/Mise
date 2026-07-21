-- Paid-product setup persistence.
-- Stores onboarding import references as metadata only. Raw screenshots, files,
-- OCR output, OAuth tokens, provider secrets, and supplier credentials must stay
-- out of client-readable public tables.

create table if not exists public.setup_attachments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('csv', 'screenshot')),
  label text not null,
  status text not null default 'queued' check (status in ('queued', 'review_needed', 'processed', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.setup_attachments is
  'Tenant-scoped setup import metadata only. Do not store raw screenshots, file contents, OCR output, OAuth tokens, provider secrets, or supplier credentials here.';

comment on column public.setup_attachments.metadata is
  'Non-secret setup reference metadata such as source labels and local reference ids only.';

drop trigger if exists set_setup_attachments_updated_at on public.setup_attachments;
create trigger set_setup_attachments_updated_at
before update on public.setup_attachments
for each row execute function public.set_updated_at();

alter table public.setup_attachments enable row level security;

drop policy if exists "Members can read setup attachments" on public.setup_attachments;
drop policy if exists "Managers can insert setup attachments" on public.setup_attachments;
drop policy if exists "Managers can update setup attachments" on public.setup_attachments;
drop policy if exists "Owners and admins can delete setup attachments" on public.setup_attachments;

create policy "Members can read setup attachments"
on public.setup_attachments for select to authenticated
using (private.is_restaurant_member(restaurant_id));

create policy "Managers can insert setup attachments"
on public.setup_attachments for insert to authenticated
with check (
  private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager'])
  and created_by = auth.uid()
);

create policy "Managers can update setup attachments"
on public.setup_attachments for update to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']))
with check (private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager']));

create policy "Owners and admins can delete setup attachments"
on public.setup_attachments for delete to authenticated
using (private.has_restaurant_role(restaurant_id, array['owner', 'admin']));

revoke all on public.setup_attachments from anon;
grant select, insert, update, delete on public.setup_attachments to authenticated;

create index if not exists idx_setup_attachments_restaurant_id
on public.setup_attachments(restaurant_id);

create index if not exists idx_setup_attachments_restaurant_status
on public.setup_attachments(restaurant_id, status);

create index if not exists idx_inventory_items_restaurant_item_name
on public.inventory_items(restaurant_id, item_name);
