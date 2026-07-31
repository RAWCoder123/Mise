-- Minimal storage locations + inventory transfer.
-- Location balances are reconciled at transfer time; restaurant on-hand
-- (inventory_items.current_quantity) remains the planning authority.

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_locations_name_check
    check (
      char_length(btrim(name)) between 1 and 80
      and name = btrim(name)
      and name !~ '[[:cntrl:]]'
    ),
  constraint storage_locations_sort_order_check
    check (sort_order between 0 and 100000)
);

create unique index if not exists storage_locations_restaurant_name_uidx
  on public.storage_locations (restaurant_id, lower(name));

create index if not exists storage_locations_restaurant_active_idx
  on public.storage_locations (restaurant_id, is_active, sort_order, name);

alter table public.storage_locations enable row level security;

drop policy if exists "Members can read storage locations" on public.storage_locations;
create policy "Members can read storage locations"
on public.storage_locations for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.storage_locations from public, anon, authenticated;
grant select on public.storage_locations to authenticated;
grant select, insert, update, delete on public.storage_locations to service_role;

comment on table public.storage_locations is
  'Restaurant storage stations (walk-in, line, dry). Members may read; writes go through RPCs/service workflows.';

create table if not exists public.inventory_location_balances (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  inventory_item_id uuid not null,
  storage_location_id uuid not null,
  quantity numeric not null default 0
    check (quantity >= 0 and quantity <= 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_location_balances_item_tenant_fkey
    foreign key (restaurant_id, inventory_item_id)
    references public.inventory_items (restaurant_id, id)
    on delete cascade,
  constraint inventory_location_balances_location_tenant_fkey
    foreign key (restaurant_id, storage_location_id)
    references public.storage_locations (restaurant_id, id)
    on delete restrict,
  constraint inventory_location_balances_item_location_uidx
    unique (inventory_item_id, storage_location_id)
);

create index if not exists inventory_location_balances_restaurant_item_idx
  on public.inventory_location_balances (restaurant_id, inventory_item_id);

create index if not exists inventory_location_balances_restaurant_location_idx
  on public.inventory_location_balances (restaurant_id, storage_location_id);

alter table public.inventory_location_balances enable row level security;

drop policy if exists "Members can read inventory location balances" on public.inventory_location_balances;
create policy "Members can read inventory location balances"
on public.inventory_location_balances for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.inventory_location_balances from public, anon, authenticated;
grant select on public.inventory_location_balances to authenticated;
grant select, insert, update, delete on public.inventory_location_balances to service_role;

comment on table public.inventory_location_balances is
  'Per-location on-hand breakdown. Reconciled at transfer time; restaurant total remains inventory_items.current_quantity.';

create or replace function private.ensure_main_storage_location(
  p_restaurant_id uuid
)
returns public.storage_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  location_row public.storage_locations%rowtype;
begin
  select * into location_row
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and lower(name) = 'main'
  limit 1;

  if found then
    if not location_row.is_active then
      update public.storage_locations
      set is_active = true,
          updated_at = clock_timestamp()
      where id = location_row.id
      returning * into location_row;
    end if;
    return location_row;
  end if;

  insert into public.storage_locations (
    restaurant_id,
    name,
    sort_order,
    is_active
  ) values (
    p_restaurant_id,
    'Main',
    0,
    true
  )
  returning * into location_row;

  return location_row;
end;
$$;

revoke all on function private.ensure_main_storage_location(uuid) from public, anon, authenticated;
grant execute on function private.ensure_main_storage_location(uuid) to service_role;

create or replace function public.create_storage_location(
  p_restaurant_id uuid,
  p_name text
)
returns public.storage_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_name text;
  created_row public.storage_locations%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  normalized_name := btrim(coalesce(p_name, ''));
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 80 then
    raise exception 'Storage location name must be between 1 and 80 characters' using errcode = '22023';
  end if;
  if normalized_name ~ '[[:cntrl:]]' then
    raise exception 'Storage location name is invalid' using errcode = '22023';
  end if;
  if lower(normalized_name) = 'main' then
    raise exception '"Main" is reserved and created automatically' using errcode = '22023';
  end if;

  perform private.ensure_main_storage_location(p_restaurant_id);

  insert into public.storage_locations (
    restaurant_id,
    name,
    sort_order,
    is_active
  ) values (
    p_restaurant_id,
    normalized_name,
    100,
    true
  )
  returning * into created_row;

  return created_row;
exception
  when unique_violation then
    raise exception 'A storage location with that name already exists' using errcode = '23505';
end;
$$;

revoke all on function public.create_storage_location(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.create_storage_location(uuid, text) to authenticated;

create or replace function private.service_transfer_inventory(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_from_storage_location_id uuid,
  p_to_storage_location_id uuid,
  p_quantity numeric,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  main_location public.storage_locations%rowtype;
  from_location public.storage_locations%rowtype;
  to_location public.storage_locations%rowtype;
  from_balance public.inventory_location_balances%rowtype;
  to_balance public.inventory_location_balances%rowtype;
  balance_count integer := 0;
  balance_sum numeric := 0;
  quantity_before numeric;
  quantity_after numeric;
  quantity_moved numeric;
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  movement_metadata jsonb;
  seeded_main boolean := false;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_from_storage_location_id is null or p_to_storage_location_id is null then
    raise exception 'Choose both a source and destination storage location' using errcode = '22023';
  end if;
  if p_from_storage_location_id = p_to_storage_location_id then
    raise exception 'Choose different storage locations for a transfer' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception 'Transfer quantity is outside supported limits' using errcode = '22023';
  end if;
  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Transfer note is outside supported limits' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found';
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  select * into from_location
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and id = p_from_storage_location_id
    and is_active = true;
  if not found then
    raise exception 'Source storage location not found' using errcode = '22023';
  end if;

  select * into to_location
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and id = p_to_storage_location_id
    and is_active = true;
  if not found then
    raise exception 'Destination storage location not found' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(quantity), 0)
    into balance_count, balance_sum
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id;

  if balance_count = 0 then
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      main_location.id,
      item_row.current_quantity
    );
    seeded_main := true;
  elsif balance_sum is distinct from item_row.current_quantity then
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      main_location.id,
      greatest(0, item_row.current_quantity - balance_sum)
    )
    on conflict (inventory_item_id, storage_location_id)
    do update set
      quantity = greatest(
        0,
        public.inventory_location_balances.quantity
          + (item_row.current_quantity - balance_sum)
      ),
      updated_at = clock_timestamp();
  end if;

  select * into from_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = p_from_storage_location_id
  for update;
  if not found then
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      p_from_storage_location_id,
      0
    )
    returning * into from_balance;
  end if;

  select * into to_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = p_to_storage_location_id
  for update;
  if not found then
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      p_to_storage_location_id,
      0
    )
    returning * into to_balance;
  end if;

  -- Re-lock after possible inserts.
  select * into from_balance
  from public.inventory_location_balances
  where id = from_balance.id
  for update;
  select * into to_balance
  from public.inventory_location_balances
  where id = to_balance.id
  for update;

  quantity_moved := p_quantity;
  if from_balance.quantity < quantity_moved then
    raise exception 'Insufficient quantity at the source storage location' using errcode = '22023';
  end if;

  quantity_before := from_balance.quantity;
  quantity_after := from_balance.quantity - quantity_moved;

  update public.inventory_location_balances
  set quantity = quantity_after,
      updated_at = clock_timestamp()
  where id = from_balance.id;

  update public.inventory_location_balances
  set quantity = to_balance.quantity + quantity_moved,
      updated_at = clock_timestamp()
  where id = to_balance.id;

  update public.inventory_items
  set last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;

  movement_metadata := jsonb_build_object(
    'from_storage_location_id', p_from_storage_location_id,
    'to_storage_location_id', p_to_storage_location_id,
    'from_storage_location_name', from_location.name,
    'to_storage_location_name', to_location.name,
    'quantity_moved', quantity_moved,
    'from_quantity_before', quantity_before,
    'from_quantity_after', quantity_after,
    'to_quantity_before', to_balance.quantity,
    'to_quantity_after', to_balance.quantity + quantity_moved
  );
  if seeded_main then
    movement_metadata := movement_metadata || jsonb_build_object('seeded_main', true);
  end if;
  if safe_note is not null then
    movement_metadata := movement_metadata || jsonb_build_object('note', safe_note);
  end if;

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
    'transfer',
    item_row.current_quantity,
    item_row.current_quantity,
    'transfer_inventory',
    movement_metadata
  );

  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_moved', quantity_moved,
    'from_storage_location_id', p_from_storage_location_id,
    'to_storage_location_id', p_to_storage_location_id,
    'seeded_main', seeded_main
  );
end;
$$;

revoke all on function private.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function private.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

create or replace function public.service_transfer_inventory(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_from_storage_location_id uuid,
  p_to_storage_location_id uuid,
  p_quantity numeric,
  p_note text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_transfer_inventory(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_from_storage_location_id,
    p_to_storage_location_id,
    p_quantity,
    p_note
  );
$$;

revoke all on function public.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

comment on function public.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) is
  'Service-owned inventory location transfer. Authenticated clients must call through operational-workflows.';

create or replace function public.ensure_restaurant_storage_locations(
  p_restaurant_id uuid
)
returns setof public.storage_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  perform private.ensure_main_storage_location(p_restaurant_id);

  return query
  select *
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and is_active = true
  order by sort_order asc, name asc;
end;
$$;

revoke all on function public.ensure_restaurant_storage_locations(uuid) from public, anon, authenticated, service_role;
grant execute on function public.ensure_restaurant_storage_locations(uuid) to authenticated;
