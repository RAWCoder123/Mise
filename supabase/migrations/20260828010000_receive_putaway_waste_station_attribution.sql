-- Attribute supplier receives and inventory waste to storage stations.
-- Restaurant on-hand remains planning authority. Station balances move after
-- Main-first reconcile so put-away and spoilage do not invent stock.

create or replace function private.apply_inventory_receive_putaway(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_storage_location_id uuid,
  p_quantity_received numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  main_balance public.inventory_location_balances%rowtype;
  target_balance public.inventory_location_balances%rowtype;
  balance_count integer := 0;
  prior_on_hand numeric;
begin
  if p_quantity_received is null or p_quantity_received <= 0 then
    return;
  end if;

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  if p_storage_location_id is null or p_storage_location_id = main_location.id then
    target_location := main_location;
  else
    select * into target_location
    from public.storage_locations
    where restaurant_id = p_restaurant_id
      and id = p_storage_location_id
      and is_active = true
    for update;
    if not found then
      raise exception 'Storage location not found' using errcode = '22023';
    end if;
  end if;

  select count(*) into balance_count
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id;

  if balance_count = 0 then
    if target_location.id = main_location.id then
      return;
    end if;
    prior_on_hand := greatest(0, item_row.current_quantity - p_quantity_received);
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, main_location.id, prior_on_hand
    );
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, target_location.id, p_quantity_received
    );
    return;
  end if;

  -- Existing station rows: land the receipt on Main first.
  select * into main_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = main_location.id
  for update;

  if found then
    update public.inventory_location_balances
    set quantity = main_balance.quantity + p_quantity_received,
        updated_at = clock_timestamp()
    where id = main_balance.id
    returning * into main_balance;
  else
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, main_location.id, p_quantity_received
    )
    returning * into main_balance;
  end if;

  if target_location.id = main_location.id then
    return;
  end if;

  if main_balance.quantity + 0.000000001 < p_quantity_received then
    raise exception 'Insufficient Main quantity available for receive put-away'
      using errcode = '22023';
  end if;

  update public.inventory_location_balances
  set quantity = main_balance.quantity - p_quantity_received,
      updated_at = clock_timestamp()
  where id = main_balance.id;

  select * into target_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = target_location.id
  for update;

  if found then
    update public.inventory_location_balances
    set quantity = target_balance.quantity + p_quantity_received,
        updated_at = clock_timestamp()
    where id = target_balance.id;
  else
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, target_location.id, p_quantity_received
    );
  end if;
end;
$$;

revoke all on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric)
  to service_role;

comment on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric) is
  'After a receipt increases restaurant on-hand, land the increase on Main then move it onto the chosen put-away station without changing on-hand.';

create or replace function private.apply_inventory_waste_station_deduction(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_storage_location_id uuid,
  p_quantity_removed numeric,
  p_main_quantity_before numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  main_balance public.inventory_location_balances%rowtype;
  target_balance public.inventory_location_balances%rowtype;
  quantity_moved numeric;
begin
  if p_quantity_removed is null or p_quantity_removed <= 0 then
    return;
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  if p_storage_location_id is null or p_storage_location_id = main_location.id then
    return;
  end if;

  select * into target_location
  from public.storage_locations
  where restaurant_id = p_restaurant_id
    and id = p_storage_location_id
    and is_active = true
  for update;
  if not found then
    raise exception 'Storage location not found' using errcode = '22023';
  end if;

  quantity_moved := least(p_quantity_removed, greatest(coalesce(p_main_quantity_before, 0), 0));
  if quantity_moved <= 0.000000001 then
    return;
  end if;

  select * into target_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = p_storage_location_id
  for update;
  if not found or target_balance.quantity + 0.000000001 < quantity_moved then
    raise exception 'Insufficient quantity at the selected storage location'
      using errcode = '22023';
  end if;

  update public.inventory_location_balances
  set quantity = target_balance.quantity - quantity_moved,
      updated_at = clock_timestamp()
  where id = target_balance.id;

  select * into main_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = main_location.id
  for update;

  if found then
    update public.inventory_location_balances
    set quantity = main_balance.quantity + quantity_moved,
        updated_at = clock_timestamp()
    where id = main_balance.id;
  else
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, main_location.id, quantity_moved
    );
  end if;
end;
$$;

revoke all on function private.apply_inventory_waste_station_deduction(uuid, uuid, uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function private.apply_inventory_waste_station_deduction(uuid, uuid, uuid, numeric, numeric)
  to service_role;

comment on function private.apply_inventory_waste_station_deduction(uuid, uuid, uuid, numeric, numeric) is
  'After Main-first on-hand reconcile, move waste attribution onto the chosen station without changing restaurant on-hand.';

create or replace function private.reconcile_inventory_location_balances_to_on_hand(
  p_restaurant_id uuid,
  p_inventory_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  main_location public.storage_locations%rowtype;
  balance_count integer := 0;
  balance_sum numeric := 0;
begin
  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  select count(*), coalesce(sum(quantity), 0)
    into balance_count, balance_sum
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id;

  if balance_count = 0 then
    insert into public.inventory_location_balances (
      restaurant_id, inventory_item_id, storage_location_id, quantity
    ) values (
      p_restaurant_id, p_inventory_item_id, main_location.id, item_row.current_quantity
    );
    return;
  end if;

  if balance_sum is not distinct from item_row.current_quantity then
    return;
  end if;

  insert into public.inventory_location_balances (
    restaurant_id, inventory_item_id, storage_location_id, quantity
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
end;
$$;

revoke all on function private.reconcile_inventory_location_balances_to_on_hand(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.reconcile_inventory_location_balances_to_on_hand(uuid, uuid)
  to service_role;

-- Enrich append-only event metadata before insert (events cannot be updated later).
create or replace function private.enrich_inventory_event_station_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  storage_location_id uuid;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if new.event_type not in ('receipt', 'waste') then
    return new;
  end if;
  if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
    -- Supplier delivery stamps station metadata inside record_supplier_delivery
    -- before the receipt row is inserted when storageLocationId is present on a line.
    return new;
  end if;
  if not (coalesce(new.metadata, '{}'::jsonb) ? 'storage_location_id')
    and new.event_type = 'receipt'
  then
    return new;
  end if;

  main_location := private.ensure_main_storage_location(new.restaurant_id);
  storage_location_id := null;
  begin
    storage_location_id := nullif(btrim(coalesce(new.metadata->>'storage_location_id', '')), '')::uuid;
  exception when others then
    raise exception 'Storage location id is invalid' using errcode = '22023';
  end;

  if storage_location_id is null then
    target_location := main_location;
  else
    select * into target_location
    from public.storage_locations
    where restaurant_id = new.restaurant_id
      and id = storage_location_id
      and is_active = true;
    if not found then
      raise exception 'Storage location not found' using errcode = '22023';
    end if;
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
    'storage_location_id', target_location.id,
    'storage_location_name', target_location.name
  );
  return new;
end;
$$;

drop trigger if exists enrich_inventory_event_station_metadata on public.inventory_events;
create trigger enrich_inventory_event_station_metadata
before insert on public.inventory_events
for each row execute function private.enrich_inventory_event_station_metadata();

revoke all on function private.enrich_inventory_event_station_metadata()
  from public, anon, authenticated, service_role;

create or replace function private.apply_inventory_event_station_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  storage_location_id uuid;
  native_quantity numeric;
  balance_count integer := 0;
  source_available numeric := 0;
  main_quantity_before numeric := 0;
  on_hand_before numeric;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if not coalesce(new.projection_applied, false) then
    return new;
  end if;
  if new.event_type not in ('receipt', 'waste') then
    return new;
  end if;
  -- Supplier delivery applies putaway in record_supplier_delivery to avoid double-credit.
  if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
    return new;
  end if;

  select * into item_row
  from public.inventory_items
  where restaurant_id = new.restaurant_id and id = new.inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = 'P0002';
  end if;
  if item_row.canonical_quantity_per_unit is null or item_row.canonical_quantity_per_unit <= 0 then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  native_quantity := new.quantity / item_row.canonical_quantity_per_unit;
  if native_quantity <= 0 then
    return new;
  end if;

  main_location := private.ensure_main_storage_location(new.restaurant_id);
  storage_location_id := null;
  begin
    storage_location_id := nullif(btrim(coalesce(new.metadata->>'storage_location_id', '')), '')::uuid;
  exception when others then
    raise exception 'Storage location id is invalid' using errcode = '22023';
  end;

  if storage_location_id is null then
    target_location := main_location;
  else
    select * into target_location
    from public.storage_locations
    where restaurant_id = new.restaurant_id
      and id = storage_location_id
      and is_active = true
    for update;
    if not found then
      raise exception 'Storage location not found' using errcode = '22023';
    end if;
  end if;

  if new.event_type = 'receipt' then
    if not (coalesce(new.metadata, '{}'::jsonb) ? 'storage_location_id')
      and target_location.id = main_location.id
    then
      return new;
    end if;
    perform private.apply_inventory_receive_putaway(
      new.restaurant_id,
      new.inventory_item_id,
      target_location.id,
      native_quantity
    );
    return new;
  end if;

  on_hand_before := item_row.current_quantity + native_quantity;

  select count(*) into balance_count
  from public.inventory_location_balances
  where restaurant_id = new.restaurant_id
    and inventory_item_id = new.inventory_item_id;

  select coalesce(sum(quantity), 0) into main_quantity_before
  from public.inventory_location_balances
  where restaurant_id = new.restaurant_id
    and inventory_item_id = new.inventory_item_id
    and storage_location_id = main_location.id;

  if balance_count = 0 then
    main_quantity_before := on_hand_before;
    source_available := case
      when target_location.id = main_location.id then on_hand_before
      else 0
    end;
  else
    select coalesce(sum(quantity), 0) into source_available
    from public.inventory_location_balances
    where restaurant_id = new.restaurant_id
      and inventory_item_id = new.inventory_item_id
      and storage_location_id = target_location.id;
  end if;

  if source_available + 0.000000001 < native_quantity then
    raise exception 'Insufficient quantity at the selected storage location'
      using errcode = '22023';
  end if;

  if balance_count > 0 then
    perform private.reconcile_inventory_location_balances_to_on_hand(
      new.restaurant_id,
      new.inventory_item_id
    );
    perform private.apply_inventory_waste_station_deduction(
      new.restaurant_id,
      new.inventory_item_id,
      target_location.id,
      native_quantity,
      main_quantity_before
    );
  end if;

  return new;
end;
$$;

drop trigger if exists apply_inventory_event_station_attribution on public.inventory_events;
create trigger apply_inventory_event_station_attribution
after insert on public.inventory_events
for each row execute function private.apply_inventory_event_station_attribution();

revoke all on function private.apply_inventory_event_station_attribution()
  from public, anon, authenticated, service_role;

comment on function private.apply_inventory_event_station_attribution() is
  'Attributes projected receipt/waste ledger events to storage stations when station metadata is present.';

-- Wrap the current durable-supplier delivery RPC so optional per-line
-- storageLocationId put-away runs in the same transaction as the receipt.
alter function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) rename to record_supplier_delivery_pre_station_putaway;

revoke all on function public.record_supplier_delivery_pre_station_putaway(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;

create function public.record_supplier_delivery(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_client_delivery_id text,
  p_received_at timestamptz,
  p_lines jsonb,
  p_invoice_total numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  delivery_id uuid;
  delivery_line jsonb;
  line_number integer := 0;
  inventory_item_id uuid;
  substitution_item_id uuid;
  received_quantity numeric;
  damaged_quantity numeric;
  line_canonical_unit text;
  storage_location_id uuid;
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  item_row public.inventory_items%rowtype;
  native_quantity numeric;
  putaway_quantity numeric;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  base_result := public.record_supplier_delivery_pre_station_putaway(
    p_restaurant_id,
    p_supplier_order_id,
    p_client_delivery_id,
    p_received_at,
    p_lines,
    p_invoice_total,
    p_notes
  );

  if coalesce(base_result->>'outcome', '') <> 'applied' then
    return base_result;
  end if;

  begin
    delivery_id := (base_result->'delivery'->>'id')::uuid;
  exception when others then
    delivery_id := null;
  end;
  if delivery_id is null then
    return base_result;
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  for delivery_line in select value from jsonb_array_elements(p_lines)
  loop
    line_number := line_number + 1;
    begin
      inventory_item_id := (delivery_line->>'inventoryItemId')::uuid;
      substitution_item_id := nullif(delivery_line->>'substitutionInventoryItemId', '')::uuid;
      received_quantity := (delivery_line->>'receivedQuantity')::numeric;
      damaged_quantity := coalesce(nullif(delivery_line->>'damagedQuantity', '')::numeric, 0);
      line_canonical_unit := delivery_line->>'canonicalUnit';
      storage_location_id := nullif(btrim(coalesce(delivery_line->>'storageLocationId', '')), '')::uuid;
    exception when others then
      raise exception 'Delivery line % is invalid', line_number using errcode = '22023';
    end;

    putaway_quantity := greatest(0, coalesce(received_quantity, 0) - coalesce(damaged_quantity, 0));
    if putaway_quantity <= 0 then
      continue;
    end if;

    if storage_location_id is null then
      target_location := main_location;
    else
      select * into target_location
      from public.storage_locations
      where restaurant_id = p_restaurant_id
        and id = storage_location_id
        and is_active = true
      for update;
      if not found then
        raise exception 'Storage location not found' using errcode = '22023';
      end if;
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id
      and id = coalesce(substitution_item_id, inventory_item_id)
    for update;
    if not found then
      raise exception 'Delivery line item not found' using errcode = 'P0002';
    end if;
    if item_row.canonical_quantity_per_unit is null
      or item_row.canonical_quantity_per_unit <= 0
      or item_row.canonical_unit is distinct from line_canonical_unit
    then
      raise exception 'Delivery line canonical unit is not verified' using errcode = '22023';
    end if;

    native_quantity := putaway_quantity / item_row.canonical_quantity_per_unit;

    perform private.apply_inventory_receive_putaway(
      p_restaurant_id,
      item_row.id,
      target_location.id,
      native_quantity
    );
  end loop;

  return base_result;
end;
$$;

revoke all on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) to authenticated;

comment on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) is
  'Records a supplier delivery and optionally puts received stock away to a storage station from each line storageLocationId.';
