-- Confirm external supplier placement without Gmail, and receive sent orders
-- into on-hand inventory through the append-only inventory_movements ledger.

create or replace function public.confirm_supplier_order_placed(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  ordered_rows jsonb := '[]'::jsonb;
  workflow_outcome text := 'applied';
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found'; end if;

  if order_row.status in ('sent', 'completed') then
    workflow_outcome := 'already_applied';
  elsif order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be confirmed as placed' using errcode = '22023';
  else
    update public.supplier_orders
    set status = 'sent'
    where restaurant_id = p_restaurant_id
      and id = p_order_id
      and status = 'draft'
    returning * into order_row;

    update public.purchase_recommendations
    set status = 'ordered'
    where restaurant_id = p_restaurant_id
      and supplier_order_id = p_order_id
      and status = 'approved';

    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      auth.uid(),
      'supplier_order_placed_externally',
      'supplier_orders',
      order_row.id,
      jsonb_build_object(
        'supplier_name', order_row.supplier_name,
        'placement_channel', 'manual_external',
        'ordered_recommendation_count', (
          select count(*)
          from public.purchase_recommendations recommendation
          where recommendation.restaurant_id = p_restaurant_id
            and recommendation.supplier_order_id = p_order_id
            and recommendation.status = 'ordered'
        )
      )
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at), '[]'::jsonb)
  into ordered_rows
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'ordered';

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'order', to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

revoke all on function public.confirm_supplier_order_placed(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.confirm_supplier_order_placed(uuid, uuid) to authenticated;

comment on function public.confirm_supplier_order_placed(uuid, uuid) is
  'Manager-confirmed external placement (copy/phone/vendor portal). Distinct from Gmail-backed mark_supplier_order_sent.';

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

    movement_metadata := jsonb_build_object(
      'supplier_order_id', p_order_id,
      'recommendation_id', recommendation_id,
      'quantity_ordered', quantity_ordered,
      'quantity_received', quantity_received,
      'discrepancy', discrepancy
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
        'note', line_note
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

create or replace function public.service_receive_supplier_order_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_expected_revision bigint,
  p_receive_lines jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_receive_supplier_order_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_order_id,
    p_expected_revision,
    p_receive_lines,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

comment on function public.service_receive_supplier_order_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) is
  'Service-owned supplier-order receiving path. Authenticated clients must call through operational-workflows.';
