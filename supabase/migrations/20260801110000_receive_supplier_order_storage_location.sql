-- Attribute supplier-order receives to an optional put-away storage location.
-- Quantity increases still reconcile onto Main first; non-Main targets then
-- receive a balance-only put-away so station health matches where stock landed.

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
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  main_balance public.inventory_location_balances%rowtype;
  target_balance public.inventory_location_balances%rowtype;
begin
  if p_quantity_received is null or p_quantity_received <= 0 then
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

  select * into main_balance
  from public.inventory_location_balances
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and storage_location_id = main_location.id
  for update;
  if not found or main_balance.quantity + 0.000000001 < p_quantity_received then
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
    and storage_location_id = p_storage_location_id
  for update;

  if found then
    update public.inventory_location_balances
    set quantity = target_balance.quantity + p_quantity_received,
        updated_at = clock_timestamp()
    where id = target_balance.id;
  else
    insert into public.inventory_location_balances (
      restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity
    ) values (
      p_restaurant_id,
      p_inventory_item_id,
      p_storage_location_id,
      p_quantity_received
    );
  end if;
end;
$$;

revoke all on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric)
  to service_role;

comment on function private.apply_inventory_receive_putaway(uuid, uuid, uuid, numeric) is
  'Move a just-received on-hand increase from Main onto the chosen put-away station without changing restaurant on-hand.';

create or replace function private.service_receive_supplier_order_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_expected_revision bigint,
  p_receive_lines jsonb,
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
  order_row public.supplier_orders%rowtype;
  linked_count integer := 0;
  line_count integer := 0;
  line_entry jsonb;
  inventory_item_id uuid;
  quantity_received numeric;
  quantity_ordered numeric;
  quantity_before numeric;
  quantity_after numeric;
  discrepancy numeric;
  line_note text;
  storage_location_id uuid;
  main_location public.storage_locations%rowtype;
  target_location public.storage_locations%rowtype;
  recommendation_id uuid;
  item_row public.inventory_items%rowtype;
  movement_metadata jsonb;
  received_lines jsonb := '[]'::jsonb;
  discrepancy_count integer := 0;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if order_row.status = 'completed' then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'order', to_jsonb(order_row),
      'received_lines', '[]'::jsonb,
      'discrepancy_count', 0
    );
  end if;

  if order_row.status <> 'sent' then
    raise exception 'Only sent supplier orders can be received' using errcode = '22023';
  end if;

  if p_receive_lines is null or jsonb_typeof(p_receive_lines) <> 'array' then
    raise exception 'Receive lines must be an array' using errcode = '22023';
  end if;

  select count(*) into linked_count
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'ordered';
  if linked_count < 1 then
    raise exception 'This order has no ordered recommendation lines to receive' using errcode = '22023';
  end if;

  line_count := jsonb_array_length(p_receive_lines);
  if line_count <> linked_count then
    raise exception 'Receive every ordered line before completing the delivery' using errcode = '22023';
  end if;

  if (
    select count(distinct line->>'inventory_item_id')
    from jsonb_array_elements(p_receive_lines) as line
  ) <> line_count then
    raise exception 'Each inventory item can appear only once in a receive payload' using errcode = '22023';
  end if;

  main_location := private.ensure_main_storage_location(p_restaurant_id);

  for line_entry in
    select value from jsonb_array_elements(p_receive_lines)
  loop
    begin
      inventory_item_id := (line_entry->>'inventory_item_id')::uuid;
    exception when others then
      raise exception 'Receive line inventory_item_id is invalid' using errcode = '22023';
    end;

    begin
      quantity_received := (line_entry->>'quantity_received')::numeric;
    exception when others then
      raise exception 'Receive line quantity_received is invalid' using errcode = '22023';
    end;

    if quantity_received is null or quantity_received < 0 or quantity_received > 1000000 then
      raise exception 'Received quantity is outside supported limits' using errcode = '22023';
    end if;

    line_note := nullif(btrim(coalesce(line_entry->>'note', '')), '');
    if line_note is not null and char_length(line_note) > 240 then
      raise exception 'Receive note is outside supported limits' using errcode = '22023';
    end if;

    storage_location_id := null;
    if nullif(btrim(coalesce(line_entry->>'storage_location_id', '')), '') is not null then
      begin
        storage_location_id := (line_entry->>'storage_location_id')::uuid;
      exception when others then
        raise exception 'Receive line storage_location_id is invalid' using errcode = '22023';
      end;
    end if;

    if storage_location_id is null then
      storage_location_id := main_location.id;
      target_location := main_location;
    else
      select * into target_location
      from public.storage_locations
      where restaurant_id = p_restaurant_id
        and id = storage_location_id
        and is_active = true;
      if not found then
        raise exception 'Storage location not found' using errcode = '22023';
      end if;
    end if;

    select recommendation.id, recommendation.recommended_quantity
      into recommendation_id, quantity_ordered
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'ordered'
      and recommendation.inventory_item_id = inventory_item_id
    for update;
    if not found then
      raise exception 'Receive line does not match an ordered recommendation' using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = inventory_item_id
    for update;
    if not found then raise exception 'Inventory item not found'; end if;

    quantity_before := item_row.current_quantity;
    quantity_after := quantity_before + quantity_received;
    discrepancy := quantity_received - quantity_ordered;
    if discrepancy <> 0 then
      discrepancy_count := discrepancy_count + 1;
    end if;

    update public.inventory_items
    set current_quantity = quantity_after,
        last_updated = clock_timestamp()
    where restaurant_id = p_restaurant_id and id = inventory_item_id
    returning * into item_row;

    perform private.apply_inventory_receive_putaway(
      p_restaurant_id,
      inventory_item_id,
      storage_location_id,
      quantity_received
    );

    movement_metadata := jsonb_build_object(
      'supplier_order_id', p_order_id,
      'recommendation_id', recommendation_id,
      'quantity_ordered', quantity_ordered,
      'quantity_received', quantity_received,
      'discrepancy', discrepancy,
      'storage_location_id', storage_location_id,
      'storage_location_name', target_location.name
    );
    if line_note is not null then
      movement_metadata := movement_metadata || jsonb_build_object('note', line_note);
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
      inventory_item_id,
      p_actor_user_id,
      'receiving',
      quantity_before,
      quantity_after,
      'receive_supplier_order',
      movement_metadata
    );

    received_lines := received_lines || jsonb_build_array(
      jsonb_build_object(
        'inventory_item_id', inventory_item_id,
        'recommendation_id', recommendation_id,
        'quantity_before', quantity_before,
        'quantity_ordered', quantity_ordered,
        'quantity_received', quantity_received,
        'quantity_after', quantity_after,
        'discrepancy', discrepancy,
        'note', line_note,
        'storage_location_id', storage_location_id,
        'storage_location_name', target_location.name
      )
    );
  end loop;

  update public.supplier_orders
  set status = 'completed'
  where restaurant_id = p_restaurant_id
    and id = p_order_id
    and status = 'sent'
  returning * into order_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    p_actor_user_id,
    'supplier_order_received',
    'supplier_orders',
    order_row.id,
    jsonb_build_object(
      'supplier_name', order_row.supplier_name,
      'line_count', line_count,
      'discrepancy_count', discrepancy_count
    )
  );

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'order', to_jsonb(order_row),
    'received_lines', received_lines,
    'discrepancy_count', discrepancy_count
  );
end;
$$;

revoke all on function private.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

comment on function private.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) is
  'Service-owned supplier-order receiving with optional per-line put-away storage attribution.';
