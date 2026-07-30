-- Close residual authenticated Data API writes on secondary operational tables,
-- and introduce an auditable inventory movement ledger for count changes.

-- ---------------------------------------------------------------------------
-- 1) Inventory movements (append-only ledger)
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (
    reason in (
      'manual_count',
      'manager_correction',
      'receiving',
      'waste',
      'transfer',
      'pos_consumption',
      'recipe_consumption',
      'system_adjustment'
    )
  ),
  quantity_before numeric not null check (quantity_before >= 0 and quantity_before <= 1000000),
  quantity_after numeric not null check (quantity_after >= 0 and quantity_after <= 1000000),
  delta numeric not null generated always as (quantity_after - quantity_before) stored,
  source_workflow text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_movements_item_tenant_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id)
    on delete cascade,
  constraint inventory_movements_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists inventory_movements_restaurant_item_created_idx
  on public.inventory_movements (restaurant_id, inventory_item_id, created_at desc);

create index if not exists inventory_movements_restaurant_created_idx
  on public.inventory_movements (restaurant_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "Members can read inventory movements" on public.inventory_movements;
create policy "Members can read inventory movements"
on public.inventory_movements for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.inventory_movements from public, anon, authenticated;
grant select on public.inventory_movements to authenticated;
grant select, insert, update, delete on public.inventory_movements to service_role;

comment on table public.inventory_movements is
  'Append-only inventory quantity ledger. Clients may read tenant rows; writes happen only through service-owned workflows.';

-- ---------------------------------------------------------------------------
-- 2) Record movements inside inventory count commits
-- ---------------------------------------------------------------------------

create or replace function private.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  safe_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_changed boolean := false;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;
  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;
  if jsonb_typeof(safe_patch) <> 'object' or safe_patch = '{}'::jsonb
     or safe_patch - array['current_quantity', 'par_level', 'reorder_threshold', 'supplier_name'] <> '{}'::jsonb then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;
  select * into item_row from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  quantity_before := item_row.current_quantity;
  item_row.current_quantity := case when safe_patch ? 'current_quantity' then (safe_patch->>'current_quantity')::numeric else item_row.current_quantity end;
  item_row.par_level := case when safe_patch ? 'par_level' then (safe_patch->>'par_level')::numeric else item_row.par_level end;
  item_row.reorder_threshold := case when safe_patch ? 'reorder_threshold' then (safe_patch->>'reorder_threshold')::numeric else item_row.reorder_threshold end;
  item_row.supplier_name := case when safe_patch ? 'supplier_name' then trim(safe_patch->>'supplier_name') else item_row.supplier_name end;
  if item_row.current_quantity not between 0 and 1000000
     or item_row.par_level not between 0 and 1000000
     or item_row.reorder_threshold not between 0 and 1000000
     or length(item_row.supplier_name) not between 1 and 160 then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;
  quantity_changed := item_row.current_quantity is distinct from quantity_before;
  update public.inventory_items
  set current_quantity = item_row.current_quantity,
      par_level = item_row.par_level,
      reorder_threshold = item_row.reorder_threshold,
      supplier_name = item_row.supplier_name,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;
  if quantity_changed then
    insert into public.inventory_movements (
      restaurant_id,
      inventory_item_id,
      actor_user_id,
      reason,
      quantity_before,
      quantity_after,
      source_workflow,
      metadata
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      p_actor_user_id,
      'manual_count',
      quantity_before,
      item_row.current_quantity,
      'update_inventory',
      jsonb_build_object(
        'par_level', item_row.par_level,
        'reorder_threshold', item_row.reorder_threshold
      )
    );
  end if;
  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );
  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_before', quantity_before,
    'quantity_changed', quantity_changed
  );
end;
$$;

revoke all on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  to service_role;

create or replace function public.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_update_inventory_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_expected_revision,
    p_patch,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) Revoke authenticated DML on secondary tables (SELECT remains)
-- ---------------------------------------------------------------------------

drop policy if exists "Owners and admins can insert pos integrations" on public.pos_integrations;
drop policy if exists "Owners and admins can update pos integrations" on public.pos_integrations;
drop policy if exists "Owners and admins can delete pos integrations" on public.pos_integrations;

drop policy if exists "Managers can insert sales imports" on public.sales_imports;
drop policy if exists "Managers can update sales imports" on public.sales_imports;
drop policy if exists "Owners and admins can delete sales imports" on public.sales_imports;

drop policy if exists "Managers can insert supplier items" on public.supplier_items;
drop policy if exists "Managers can update supplier items" on public.supplier_items;
drop policy if exists "Owners and admins can delete supplier items" on public.supplier_items;

drop policy if exists "Managers can insert purchase orders" on public.purchase_orders;
drop policy if exists "Managers can update purchase orders" on public.purchase_orders;
drop policy if exists "Owners and admins can delete purchase orders" on public.purchase_orders;

revoke insert, update, delete on table
  public.pos_integrations,
  public.sales_imports,
  public.supplier_items,
  public.purchase_orders
from authenticated;

comment on table public.pos_integrations is
  'POS connection metadata. Authenticated clients have SELECT only; mutations are service/Edge owned.';
comment on table public.sales_imports is
  'POS/CSV import history. Authenticated clients have SELECT only; mutations are service/Edge owned.';
comment on table public.supplier_items is
  'Supplier catalog rows. Authenticated clients have SELECT only; mutations are service owned.';
comment on table public.purchase_orders is
  'Formal purchase-order records. Authenticated clients have SELECT only; mutations are service owned.';

-- ---------------------------------------------------------------------------
-- 4) Account deletion request records + authenticated RPC
-- ---------------------------------------------------------------------------

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  -- Nullable so Auth hard-delete can complete without erasing the audit row.
  user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid not null,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'cancelled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  memberships_disabled integer not null default 0 check (memberships_disabled >= 0),
  metadata jsonb not null default '{}'::jsonb,
  constraint account_deletion_requests_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists account_deletion_requests_one_open_per_user_idx
  on public.account_deletion_requests (subject_user_id)
  where (status in ('requested', 'processing'));

create index if not exists account_deletion_requests_user_requested_idx
  on public.account_deletion_requests (subject_user_id, requested_at desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read own account deletion requests" on public.account_deletion_requests;
create policy "Users can read own account deletion requests"
on public.account_deletion_requests for select to authenticated
using (subject_user_id = auth.uid());

revoke all on table public.account_deletion_requests from public, anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
grant select, insert, update, delete on public.account_deletion_requests to service_role;

create or replace function public.request_my_account_deletion(
  p_confirmation text default 'DELETE'
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  disabled_count integer := 0;
  request_row public.account_deletion_requests;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if upper(trim(coalesce(p_confirmation, ''))) <> 'DELETE' then
    raise exception 'Account deletion confirmation is required' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_user_id::text || E'\x1faccount-deletion', 0)
  );

  update public.restaurant_memberships
  set status = 'disabled',
      updated_at = clock_timestamp()
  where user_id = actor_user_id
    and status = 'active';

  get diagnostics disabled_count = row_count;

  select * into request_row
  from public.account_deletion_requests
  where subject_user_id = actor_user_id
    and status in ('requested', 'processing')
  order by requested_at desc
  limit 1
  for update;

  if found then
    update public.account_deletion_requests
    set memberships_disabled = greatest(memberships_disabled, disabled_count),
        user_id = actor_user_id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'source', 'request_my_account_deletion',
          'rerequested_at', clock_timestamp()
        )
    where id = request_row.id
    returning * into request_row;
  else
    insert into public.account_deletion_requests (
      user_id,
      subject_user_id,
      status,
      memberships_disabled,
      metadata
    ) values (
      actor_user_id,
      actor_user_id,
      'requested',
      disabled_count,
      jsonb_build_object('source', 'request_my_account_deletion')
    )
    returning * into request_row;
  end if;

  return request_row;
end;
$$;

comment on function public.request_my_account_deletion(text) is
  'Disables every active membership for the caller and records an account deletion request. Auth user hard-delete is completed by the request-account-deletion Edge Function.';

revoke all on function public.request_my_account_deletion(text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_my_account_deletion(text)
  to authenticated;
