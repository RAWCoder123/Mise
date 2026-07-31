-- Add a service-owned waste / spoilage write path that updates on-hand quantity
-- through the append-only inventory_movements ledger and refreshes planning signals.

create or replace function private.service_record_inventory_waste_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_quantity_removed numeric,
  p_note text,
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
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_removed_requested numeric;
  quantity_removed_applied numeric;
  quantity_after numeric;
  floored boolean := false;
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  movement_metadata jsonb;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
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

  update public.inventory_items
  set current_quantity = quantity_after,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;

  movement_metadata := jsonb_build_object(
    'quantity_removed_requested', quantity_removed_requested,
    'quantity_removed_applied', quantity_removed_applied,
    'floored', floored
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
    'floored', floored
  );
end;
$$;

revoke all on function private.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
) to service_role;

create or replace function public.service_record_inventory_waste_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_quantity_removed numeric,
  p_note text,
  p_recommendations jsonb,
  p_insights jsonb
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
    p_insights
  );
$$;

revoke all on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
) to service_role;

comment on function public.service_record_inventory_waste_and_signals(
  uuid, uuid, uuid, bigint, numeric, text, jsonb, jsonb
) is
  'Service-owned waste / spoilage write path. Authenticated clients must call through operational-workflows.';
