-- Final beta hardening for multi-restaurant data isolation.
-- This migration is intentionally additive/revoking so already-applied beta
-- databases are tightened without relying on edited historical migrations.

-- The public.users table is legacy profile metadata. Restaurant authorization
-- must come from restaurant_memberships, so clients may only edit their display
-- name and can never self-assign restaurant_id or role through this table.
revoke update on public.users from authenticated;
grant update (name) on public.users to authenticated;

comment on table public.users is
  'Legacy user profile metadata. Authorization is controlled by public.restaurant_memberships, not users.restaurant_id or users.role.';
comment on column public.users.restaurant_id is
  'Legacy/default restaurant pointer only. Do not use for authorization.';
comment on column public.users.role is
  'Legacy display/default role only. Do not use for authorization.';

-- Composite tenant keys let child rows prove that their referenced record
-- belongs to the same restaurant_id. This closes ID-only cross-tenant reference
-- attacks if a malicious client guesses or obtains another restaurant row UUID.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_items_restaurant_id_id_key'
      and conrelid = 'public.inventory_items'::regclass
  ) then
    alter table public.inventory_items
      add constraint inventory_items_restaurant_id_id_key unique (restaurant_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pos_integrations_restaurant_id_id_key'
      and conrelid = 'public.pos_integrations'::regclass
  ) then
    alter table public.pos_integrations
      add constraint pos_integrations_restaurant_id_id_key unique (restaurant_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_item_ingredients_inventory_item_tenant_fkey'
      and conrelid = 'public.menu_item_ingredients'::regclass
  ) then
    alter table public.menu_item_ingredients
      add constraint menu_item_ingredients_inventory_item_tenant_fkey
      foreign key (restaurant_id, inventory_item_id)
      references public.inventory_items(restaurant_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_recommendations_inventory_item_tenant_fkey'
      and conrelid = 'public.purchase_recommendations'::regclass
  ) then
    alter table public.purchase_recommendations
      add constraint purchase_recommendations_inventory_item_tenant_fkey
      foreign key (restaurant_id, inventory_item_id)
      references public.inventory_items(restaurant_id, id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_imports_pos_integration_tenant_fkey'
      and conrelid = 'public.sales_imports'::regclass
  ) then
    alter table public.sales_imports
      add constraint sales_imports_pos_integration_tenant_fkey
      foreign key (restaurant_id, pos_integration_id)
      references public.pos_integrations(restaurant_id, id);
  end if;
end $$;

comment on column public.pos_integrations.settings is
  'Non-secret provider settings only. Store OAuth tokens, API keys, webhook secrets, and refresh tokens in Supabase Edge Functions/Vault, never in client-readable tables.';
comment on column public.pos_integrations.sync_cursor is
  'Provider cursor/state only. Do not store credentials or bearer tokens here.';

-- Authenticated client audit writes must identify the current JWT subject.
-- Server-side Edge Functions using elevated backend credentials may still write
-- service audit entries because privileged server connections bypass RLS.
alter table public.audit_logs
  alter column actor_user_id set default auth.uid();

revoke update, delete on public.audit_logs from authenticated;

drop policy if exists "Managers can insert audit logs" on public.audit_logs;
create policy "Managers can insert audit logs"
on public.audit_logs for insert to authenticated
with check (
  actor_user_id = auth.uid()
  and private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager'])
);
