-- Attribute inventory waste to an optional storage station.
-- On-hand decreases still reconcile Main-first; non-Main targets then receive a
-- balance-only correction so station health matches where spoilage occurred.

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
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      main_location.id,
      quantity_moved
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

drop function if exists public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
);
drop function if exists private.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
);

create or replace function private.service_record_inventory_waste_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_quantity_removed numeric,
  p_note text,
  p_recommendations jsonb,
  p_insights jsonb,
  p_storage_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_removed_requested numeric;
  quantity_removed_applied numeric;
  quantity_after numeric;
  floored boolean := false;
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  movement_metadata jsonb;
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  balance_count integer := 0;
  source_available numeric := 0;
  main_quantity_before numeric := 0;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if p_quantity_removed is null
     or p_quantity_removed <= 0
     or p_quantity_removed > 1000000 then
    raise exception 'Waste quantity is outside supported limits' using errcode = '22023';
  end if;
  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Waste note is outside supported limits' using errcode = '22023';
  end if;

  select * into item_row from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;

  quantity_before := item_row.current_quantity;
  if quantity_before <= 0 then
    raise exception 'Nothing on hand to record as waste' using errcode = '22023';
  end if;

  quantity_removed_requested := p_quantity_removed;
  quantity_removed_applied := least(quantity_removed_requested, quantity_before);
  quantity_after := greatest(0, quantity_before - quantity_removed_applied);
  floored := quantity_removed_requested > quantity_before;

  main_location := private.ensure_main_storage_location(p_restaurant_id);
  if p_storage_location_id is null then
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

  perform 1
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
  for update;

  select count(*) into balance_count
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id;

  select coalesce(sum(quantity), 0) into main_quantity_before
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = main_location.id;

  if balance_count = 0 then
    main_quantity_before := quantity_before;
    source_available := case
      when target_location.id = main_location.id then quantity_before
      else 0
    end;
  else
    select coalesce(sum(quantity), 0) into source_available
    from public.inventory_location_balances
    where restaurant_id = p_restaurant_id
      and inventory_item_id = p_inventory_item_id
      and storage_location_id = target_location.id;
  end if;

  if source_available + 0.000000001 < quantity_removed_applied then
    raise exception 'Insufficient quantity at the selected storage location'
      using errcode = '22023';
  end if;

  update public.inventory_items
  set current_quantity = quantity_after,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;

  perform private.apply_inventory_waste_station_deduction(
    p_restaurant_id,
    p_inventory_item_id,
    target_location.id,
    quantity_removed_applied,
    main_quantity_before
  );

  movement_metadata := jsonb_build_object(
    'quantity_removed_requested', quantity_removed_requested,
    'quantity_removed_applied', quantity_removed_applied,
    'floored', floored,
    'storage_location_id', target_location.id,
    'storage_location_name', target_location.name
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
    'waste',
    quantity_before,
    quantity_after,
    'record_waste',
    movement_metadata
  );

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_before', quantity_before,
    'quantity_changed', true,
    'quantity_removed_requested', quantity_removed_requested,
    'quantity_removed_applied', quantity_removed_applied,
    'floored', floored,
    'storage_location_id', target_location.id,
    'storage_location_name', target_location.name
  );
end;
$$;

revoke all on function private.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb, uuid
) from public, anon, authenticated;
grant execute on function private.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb, uuid
) to service_role;

create or replace function public.service_record_inventory_waste_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_quantity_removed numeric,
  p_note text,
  p_recommendations jsonb,
  p_insights jsonb,
  p_storage_location_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_inventory_waste_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_expected_revision,
    p_quantity_removed,
    p_note,
    p_recommendations,
    p_insights,
    p_storage_location_id
  );
$$;

revoke all on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb, uuid
) to service_role;

comment on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb, uuid
) is
  'Service-owned waste / spoilage write path with optional storage-station attribution. Authenticated clients must call through operational-workflows.';
