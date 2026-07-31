-- Keep inventory_location_balances aligned whenever restaurant on-hand changes.
-- Planning authority remains inventory_items.current_quantity; station balances
-- are adjusted on Main first (increases) and Main-then-others (decreases).

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
  delta numeric := 0;
  remaining numeric := 0;
  remove_qty numeric := 0;
  balance_row public.inventory_location_balances%rowtype;
begin
  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id
  for update;
  if not found then
    return;
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  perform 1
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
  for update;

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
    return;
  end if;

  delta := item_row.current_quantity - balance_sum;
  if abs(delta) < 0.000000001 then
    return;
  end if;

  if delta > 0 then
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      main_location.id,
      delta
    )
    on conflict (inventory_item_id, storage_location_id)
    do update set
      quantity = public.inventory_location_balances.quantity + excluded.quantity,
      updated_at = clock_timestamp();
    return;
  end if;

  remaining := -delta;

  select * into balance_row
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = main_location.id
  for update;

  if found then
    remove_qty := least(balance_row.quantity, remaining);
    update public.inventory_location_balances
    set quantity = balance_row.quantity - remove_qty,
        updated_at = clock_timestamp()
    where id = balance_row.id;
    remaining := remaining - remove_qty;
  end if;

  if remaining > 0.000000001 then
    for balance_row in
      select *
      from public.inventory_location_balances
      where restaurant_id = p_restaurant_id
        and inventory_item_id = p_inventory_item_id
        and storage_location_id <> main_location.id
      order by storage_location_id asc
      for update
    loop
      exit when remaining <= 0.000000001;
      remove_qty := least(balance_row.quantity, remaining);
      update public.inventory_location_balances
      set quantity = balance_row.quantity - remove_qty,
          updated_at = clock_timestamp()
      where id = balance_row.id;
      remaining := remaining - remove_qty;
    end loop;
  end if;
end;
$$;

revoke all on function private.reconcile_inventory_location_balances_to_on_hand(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.reconcile_inventory_location_balances_to_on_hand(uuid, uuid)
  to service_role;

comment on function private.reconcile_inventory_location_balances_to_on_hand(uuid, uuid) is
  'Align per-location balances to inventory_items.current_quantity after quantity-changing workflows.';

create or replace function private.trg_reconcile_inventory_location_balances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.current_quantity is distinct from old.current_quantity then
    perform private.reconcile_inventory_location_balances_to_on_hand(
      new.restaurant_id,
      new.id
    );
  end if;
  return new;
end;
$$;

revoke all on function private.trg_reconcile_inventory_location_balances()
  from public, anon, authenticated;

drop trigger if exists inventory_items_reconcile_location_balances on public.inventory_items;
create trigger inventory_items_reconcile_location_balances
after insert or update of current_quantity on public.inventory_items
for each row execute function private.trg_reconcile_inventory_location_balances();

comment on trigger inventory_items_reconcile_location_balances on public.inventory_items is
  'Keeps location balances synced after create/count/waste/receive/POS/setup quantity writes.';

-- Transfer already reconciles before moving stock; prefer the shared helper for drift repair.
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
  quantity_before numeric;
  quantity_after numeric;
  quantity_moved numeric;
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  movement_metadata jsonb;
  balance_count integer := 0;
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
  perform private.reconcile_inventory_location_balances_to_on_hand(
    p_restaurant_id,
    p_inventory_item_id
  );

  select count(*) into balance_count
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id;

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
    'to_quantity_after', to_balance.quantity + quantity_moved,
    'main_storage_location_id', main_location.id,
    'reconciled_before_transfer', true,
    'balance_rows_before_transfer', balance_count
  );
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
    'to_storage_location_id', p_to_storage_location_id
  );
end;
$$;

revoke all on function private.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) from public, anon, authenticated;
grant execute on function private.service_transfer_inventory(
  uuid, uuid, uuid, uuid, uuid, numeric, text
) to service_role;

comment on table public.inventory_location_balances is
  'Per-location on-hand breakdown. Synced to inventory_items.current_quantity on quantity writes; transfers move between stations without changing restaurant total.';
