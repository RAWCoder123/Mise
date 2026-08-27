-- Storage locations + ledgered inventory transfers.
-- Restaurant on-hand (inventory_items.current_quantity) remains planning authority.
-- Transfers move inventory_location_balances only and append a quantity-0
-- inventory_events row (event_type=transfer) so projection cannot inflate stock.

create table if not exists public.storage_locations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint storage_locations_restaurant_id_id_key unique (restaurant_id, id),
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
  'Restaurant storage stations (walk-in, line, dry). Members may read; writes go through RPCs.';

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

-- Transfer ledger rows must never move restaurant on-hand.
create or replace function private.enforce_transfer_event_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.event_type = 'transfer' and new.quantity is distinct from 0 then
    raise exception 'Transfer ledger events must use quantity 0'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_transfer_event_invariants on public.inventory_events;
create trigger enforce_transfer_event_invariants
before insert on public.inventory_events
for each row execute function private.enforce_transfer_event_invariants();

revoke all on function private.enforce_transfer_event_invariants()
  from public, anon, authenticated, service_role;

-- Explicit no-op for transfer in authority stamp (belt-and-suspenders with qty 0).
create or replace function private.stamp_inventory_event_authority_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_quantity numeric;
  quantity_per_unit numeric;
  native_event_quantity numeric;
begin
  new.authority_projected_quantity := null;
  if not new.projection_applied then
    return new;
  end if;

  select item.current_quantity, item.canonical_quantity_per_unit
  into prior_quantity, quantity_per_unit
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for authority projection'
      using errcode = '23503';
  end if;
  if quantity_per_unit is null or quantity_per_unit <= 0
    or quantity_per_unit::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  native_event_quantity := new.quantity / quantity_per_unit;
  new.authority_projected_quantity := case
    when new.event_type = 'count' then native_event_quantity
    when new.event_type = 'stockout' then 0
    when new.event_type = 'receipt' then prior_quantity + native_event_quantity
    when new.event_type in ('waste', 'usage') then prior_quantity - native_event_quantity
    when new.event_type = 'transfer' then prior_quantity
    else prior_quantity + native_event_quantity
  end;

  if new.authority_projected_quantity is null
    or new.authority_projected_quantity < 0
    or new.authority_projected_quantity > 1000000
    or new.authority_projected_quantity::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise exception 'Inventory event would move on-hand outside supported limits'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.stamp_inventory_event_authority_projection()
  from public, anon, authenticated, service_role;

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

revoke all on function private.ensure_main_storage_location(uuid)
  from public, anon, authenticated;
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
  if not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  normalized_name := btrim(coalesce(p_name, ''));
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 80 then
    raise exception 'Storage location name must be between 1 and 80 characters'
      using errcode = '22023';
  end if;
  if normalized_name ~ '[[:cntrl:]]' then
    raise exception 'Storage location name is invalid' using errcode = '22023';
  end if;
  if lower(normalized_name) = 'main' then
    raise exception '"Main" is reserved and created automatically'
      using errcode = '22023';
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
    raise exception 'A storage location with that name already exists'
      using errcode = '23505';
end;
$$;

revoke all on function public.create_storage_location(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_storage_location(uuid, text) to authenticated;

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

revoke all on function public.ensure_restaurant_storage_locations(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ensure_restaurant_storage_locations(uuid) to authenticated;

create or replace function public.transfer_inventory(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_from_storage_location_id uuid,
  p_to_storage_location_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
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
  client_event_id text;
  idempotency_key text;
  inserted_event public.inventory_events%rowtype;
  on_hand_before numeric;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_from_storage_location_id is null or p_to_storage_location_id is null then
    raise exception 'Choose both a source and destination storage location'
      using errcode = '22023';
  end if;
  if p_from_storage_location_id = p_to_storage_location_id then
    raise exception 'Choose different storage locations for a transfer'
      using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000 then
    raise exception 'Transfer quantity is outside supported limits'
      using errcode = '22023';
  end if;
  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Transfer note is outside supported limits'
      using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found';
  end if;
  if item_row.canonical_unit is null
    or item_row.canonical_unit not in ('g', 'ml', 'each')
    or item_row.canonical_unit_verification_status is distinct from 'verified'
    or item_row.canonical_quantity_per_unit is null
    or item_row.canonical_quantity_per_unit <= 0
  then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  on_hand_before := item_row.current_quantity;
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
    raise exception 'Insufficient quantity at the source storage location'
      using errcode = '22023';
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

  movement_metadata := jsonb_build_object(
    'from_storage_location_id', p_from_storage_location_id,
    'to_storage_location_id', p_to_storage_location_id,
    'from_storage_location_name', from_location.name,
    'to_storage_location_name', to_location.name,
    'quantity_moved', quantity_moved,
    'from_quantity_before', quantity_before,
    'from_quantity_after', quantity_after,
    'to_quantity_before', to_balance.quantity,
    'to_quantity_after', to_balance.quantity + quantity_moved,
    'source_workflow', 'transfer_inventory'
  );
  if seeded_main then
    movement_metadata := movement_metadata || jsonb_build_object('seeded_main', true);
  end if;
  if safe_note is not null then
    movement_metadata := movement_metadata || jsonb_build_object('note', safe_note);
  end if;

  client_event_id := 'transfer:' || gen_random_uuid()::text;
  idempotency_key := 'transfer_inventory:' || client_event_id;

  insert into public.inventory_events (
    restaurant_id,
    inventory_item_id,
    event_type,
    quantity,
    canonical_unit,
    effective_at,
    actor_user_id,
    source,
    source_reference,
    reason_code,
    client_event_id,
    idempotency_key,
    supersedes_event_id,
    metadata
  ) values (
    p_restaurant_id,
    p_inventory_item_id,
    'transfer',
    0,
    item_row.canonical_unit,
    clock_timestamp(),
    actor_user_id,
    'transfer_inventory',
    null,
    'station_transfer',
    client_event_id,
    idempotency_key,
    null,
    movement_metadata
  )
  returning * into inserted_event;

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id;

  if item_row.current_quantity is distinct from on_hand_before then
    raise exception 'Transfer must not change restaurant on-hand quantity'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'inventory_event.recorded',
    'inventory_events',
    inserted_event.id,
    jsonb_build_object(
      'event_type', 'transfer',
      'client_event_id', client_event_id,
      'quantity_moved', quantity_moved,
      'from_storage_location_id', p_from_storage_location_id,
      'to_storage_location_id', p_to_storage_location_id
    )
  );

  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_moved', quantity_moved,
    'from_storage_location_id', p_from_storage_location_id,
    'to_storage_location_id', p_to_storage_location_id,
    'seeded_main', seeded_main,
    'inventory_event_id', inserted_event.id
  );
end;
$$;

revoke all on function public.transfer_inventory(
  uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.transfer_inventory(
  uuid, uuid, uuid, uuid, numeric, text
) to authenticated;

comment on function public.transfer_inventory(
  uuid, uuid, uuid, uuid, numeric, text
) is
  'Staff+ station transfer. Moves location balances only; appends quantity-0 transfer ledger evidence.';

-- Truthful activity for station transfers (not a generic quantity update).
alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'task_reopened', 'task_unblocked',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded',
    'inventory_transfer_recorded'
  ));

create or replace function private.capture_inventory_event_activity_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type text;
  event_category text := 'inventory';
  event_title text;
  event_summary text;
  event_attention boolean := false;
  event_autonomy smallint := 1;
  recent_waste_days integer := 0;
  from_name text;
  to_name text;
  moved_qty text;
begin
  if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
    return new;
  end if;

  if new.event_type = 'transfer' then
    from_name := coalesce(nullif(new.metadata->>'from_storage_location_name', ''), 'source');
    to_name := coalesce(nullif(new.metadata->>'to_storage_location_name', ''), 'destination');
    moved_qty := nullif(btrim(coalesce(new.metadata->>'quantity_moved', '')), '');
    event_type := 'inventory_transfer_recorded';
    event_category := 'inventory';
    event_title := 'Stock transferred between stations';
    event_summary := format(
      '%s moved from %s to %s.',
      coalesce(moved_qty, 'Stock'),
      from_name,
      to_name
    );
    event_attention := false;
    event_autonomy := 1;
  elsif new.event_type = 'waste' then
    select count(distinct (waste_event.effective_at at time zone restaurant.timezone)::date)
    into recent_waste_days
    from public.inventory_events waste_event
    join public.restaurants restaurant
      on restaurant.id = waste_event.restaurant_id
    where waste_event.restaurant_id = new.restaurant_id
      and waste_event.inventory_item_id = new.inventory_item_id
      and waste_event.event_type = 'waste'
      and (waste_event.effective_at at time zone restaurant.timezone)::date
        >= (new.effective_at at time zone restaurant.timezone)::date - 6
      and (waste_event.effective_at at time zone restaurant.timezone)::date
        <= (new.effective_at at time zone restaurant.timezone)::date
      and not exists (
        select 1
        from public.inventory_events correction
        where correction.restaurant_id = waste_event.restaurant_id
          and correction.event_type = 'correction'
          and correction.supersedes_event_id = waste_event.id
      );
    event_type := 'waste_analysis_completed';
    event_category := 'waste';
    event_attention := recent_waste_days >= 2;
    event_autonomy := 2;
    event_title := case
      when event_attention then 'Waste pattern needs review'
      else 'Waste recorded and analyzed'
    end;
    event_summary := format(
      '%s %s was recorded as waste%s.',
      new.quantity,
      new.canonical_unit,
      case
        when event_attention then format(' across %s recent operating days', recent_waste_days)
        else ''
      end
    );
  else
    event_type := case
      when new.event_type = 'count' then 'inventory_count_recorded'
      when new.event_type = 'receipt' then 'delivery_logged'
      when new.event_type = 'stockout' then 'inventory_risk_detected'
      else 'forecast_updated'
    end;
    event_title := case
      when new.event_type = 'count' then 'Inventory count recorded'
      when new.event_type = 'receipt' then 'Delivery quantity recorded'
      when new.event_type = 'stockout' then 'Stockout recorded'
      else 'Inventory quantity updated'
    end;
    event_summary := format('%s %s inventory event recorded.', new.quantity, new.canonical_unit);
    event_attention := new.event_type = 'stockout';
    event_autonomy := case when new.event_type in ('usage', 'adjustment') then 4 else 1 end;
  end if;

  perform private.append_activity_event(
    new.restaurant_id,
    event_type,
    event_category,
    event_title,
    event_summary,
    new.effective_at,
    'mise',
    case when new.source like 'mise%' then 'mise' else 'user' end,
    new.actor_user_id,
    new.event_type,
    new.inventory_item_id::text,
    jsonb_build_array(jsonb_build_object(
      'type', 'inventory_event',
      'id', new.id,
      'summary', format('%s %s via %s', new.quantity, new.canonical_unit, new.source),
      'observedAt', new.effective_at
    )),
    array['mise', 'inventory', new.source]::text[],
    null,
    null,
    event_autonomy,
    null,
    'completed',
    event_attention,
    null,
    'inventory_item',
    new.inventory_item_id::text,
    coalesce(new.metadata->>'sequenceId', format('inventory-item:%s', new.inventory_item_id)),
    null,
    null,
    format('inventory_event:%s', new.id),
    jsonb_build_object(
      'inventoryItemId', new.inventory_item_id,
      'eventType', new.event_type,
      'quantity', new.quantity,
      'canonicalUnit', new.canonical_unit,
      'sourceReference', new.source_reference,
      'quantityMoved', new.metadata->>'quantity_moved',
      'fromStorageLocationId', new.metadata->>'from_storage_location_id',
      'toStorageLocationId', new.metadata->>'to_storage_location_id',
      'recentWasteDays', case when new.event_type = 'waste' then recent_waste_days else null end
    ),
    null,
    null,
    null
  );
  return new;
end;
$$;

revoke all on function private.capture_inventory_event_activity_v2()
  from public, anon, authenticated, service_role;

comment on function private.capture_inventory_event_activity_v2() is
  'Maps authoritative inventory events to idempotent operator activity; transfers and repeated waste stay explicit.';
