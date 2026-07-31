-- Service-owned inventory item creation for day-2 catalog management.
-- Managers can add SKUs after setup without reopening the owner-only setup wizard.
-- Opening quantity writes an auditable manual_count ledger movement (0 → opening).

create or replace function private.service_create_inventory_item_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_item jsonb,
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
  item_count integer;
  payload record;
  item_row public.inventory_items%rowtype;
  existing_id uuid;
  movement_metadata jsonb;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item id is required' using errcode = '22023';
  end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'Inventory item payload is required' using errcode = '22023';
  end if;

  select
    trim(coalesce(p_item ->> 'item_name', '')) as item_name,
    trim(coalesce(p_item ->> 'category', '')) as category,
    trim(coalesce(p_item ->> 'unit', '')) as unit,
    trim(coalesce(p_item ->> 'supplier_name', '')) as supplier_name,
    nullif(p_item ->> 'current_quantity', '')::numeric as current_quantity,
    nullif(p_item ->> 'par_level', '')::numeric as par_level,
    nullif(p_item ->> 'reorder_threshold', '')::numeric as reorder_threshold,
    nullif(p_item ->> 'estimated_unit_cost', '')::numeric as estimated_unit_cost
  into payload;

  if length(payload.item_name) not between 1 and 160
     or length(payload.category) not between 1 and 120
     or length(payload.unit) not between 1 and 40
     or length(payload.supplier_name) not between 1 and 160
     or payload.current_quantity is null or payload.current_quantity not between 0 and 1000000
     or payload.par_level is null or payload.par_level not between 0 and 1000000
     or payload.reorder_threshold is null or payload.reorder_threshold not between 0 and 1000000
     or payload.estimated_unit_cost is null or payload.estimated_unit_cost not between 0 and 1000000 then
    raise exception 'Invalid inventory item create payload' using errcode = '22023';
  end if;

  select count(*)::integer into item_count
  from public.inventory_items
  where restaurant_id = p_restaurant_id;
  if item_count >= 250 then
    raise exception 'This restaurant already has the maximum of 250 inventory items'
      using errcode = '22023';
  end if;

  select id into existing_id
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and lower(regexp_replace(trim(item_name), '\s+', ' ', 'g'))
      = lower(regexp_replace(payload.item_name, '\s+', ' ', 'g'))
  limit 1;
  if existing_id is not null then
    raise exception 'An inventory item with this name already exists' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.inventory_items where id = p_inventory_item_id
  ) then
    raise exception 'Inventory item id already exists' using errcode = '23505';
  end if;

  insert into public.inventory_items (
    id,
    restaurant_id,
    item_name,
    category,
    unit,
    current_quantity,
    par_level,
    reorder_threshold,
    estimated_unit_cost,
    supplier_name,
    last_updated
  ) values (
    p_inventory_item_id,
    p_restaurant_id,
    payload.item_name,
    payload.category,
    payload.unit,
    payload.current_quantity,
    payload.par_level,
    payload.reorder_threshold,
    payload.estimated_unit_cost,
    payload.supplier_name,
    clock_timestamp()
  )
  returning * into item_row;

  movement_metadata := jsonb_build_object(
    'created', true,
    'item_name', payload.item_name,
    'category', payload.category,
    'unit', payload.unit,
    'supplier_name', payload.supplier_name
  );

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
    item_row.id,
    p_actor_user_id,
    'manual_count',
    0,
    item_row.current_quantity,
    'create_inventory_item',
    movement_metadata
  );

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_before', 0,
    'quantity_changed', item_row.current_quantity <> 0,
    'created', true
  );
end;
$$;

revoke all on function private.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

create or replace function public.service_create_inventory_item_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_item jsonb,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_create_inventory_item_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_expected_revision,
    p_item,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) to service_role;

comment on function public.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) is
  'Service-owned inventory item create path. Authenticated clients must call through operational-workflows.';
