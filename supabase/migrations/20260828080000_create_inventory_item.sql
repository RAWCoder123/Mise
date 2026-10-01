-- Service-owned day-2 inventory item create after setup_completed.
-- Managers add SKUs without reopening the owner-only setup wizard.
-- Durable supplier_id is required (MISE-003C). Opening stock writes an
-- inventory_events count when the unit auto-verifies; otherwise quantity is
-- seeded on the item until the first verified count (same as setup seed).

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
  supplier_row public.suppliers%rowtype;
  existing_id uuid;
  opening_ledgered boolean := false;
  stable_event_key text;
  event_metadata jsonb;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_inventory_item_id is null then
    raise exception 'Inventory item id is required' using errcode = '22023';
  end if;

  select state.planning_revision into current_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id
  for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot'
      using errcode = '40001';
  end if;

  if p_item is null or pg_catalog.jsonb_typeof(p_item) <> 'object' then
    raise exception 'Inventory item payload is required' using errcode = '22023';
  end if;

  select
    trim(coalesce(p_item ->> 'item_name', '')) as item_name,
    trim(coalesce(p_item ->> 'category', '')) as category,
    trim(coalesce(p_item ->> 'unit', '')) as unit,
    nullif(p_item ->> 'supplier_id', '')::uuid as supplier_id,
    nullif(p_item ->> 'current_quantity', '')::numeric as current_quantity,
    nullif(p_item ->> 'par_level', '')::numeric as par_level,
    nullif(p_item ->> 'reorder_threshold', '')::numeric as reorder_threshold,
    nullif(p_item ->> 'estimated_unit_cost', '')::numeric as estimated_unit_cost
  into payload;

  if length(payload.item_name) not between 1 and 160
     or length(payload.category) not between 1 and 120
     or length(payload.unit) not between 1 and 40
     or payload.supplier_id is null
     or payload.current_quantity is null or payload.current_quantity not between 0 and 1000000
     or payload.par_level is null or payload.par_level not between 0 and 1000000
     or payload.reorder_threshold is null or payload.reorder_threshold not between 0 and 1000000
     or payload.estimated_unit_cost is null or payload.estimated_unit_cost not between 0 and 1000000
  then
    raise exception 'Invalid inventory item create payload' using errcode = '22023';
  end if;

  select * into supplier_row
  from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id
    and supplier.id = payload.supplier_id
  for update;
  if not found then
    raise exception 'Supplier is not part of this restaurant catalog' using errcode = 'P0002';
  end if;
  perform private.lock_supplier_authority(p_restaurant_id, supplier_row.id);

  select count(*)::integer into item_count
  from public.inventory_items
  where restaurant_id = p_restaurant_id;
  if item_count >= 250 then
    raise exception 'This restaurant already has the maximum of 250 inventory items'
      using errcode = '22023';
  end if;

  select item.id into existing_id
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and lower(regexp_replace(trim(item.item_name), '\s+', ' ', 'g'))
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
    supplier_id,
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
    supplier_row.id,
    supplier_row.display_name,
    clock_timestamp()
  )
  returning * into item_row;

  -- Prefer an authoritative opening count when canonical conversion verified.
  if item_row.canonical_unit_verification_status = 'verified'
     and item_row.canonical_unit is not null
     and item_row.canonical_quantity_per_unit is not null
     and item_row.canonical_quantity_per_unit > 0
  then
    stable_event_key := 'create_inventory_item:' || item_row.id::text;
    event_metadata := jsonb_build_object(
      'created', true,
      'item_name', payload.item_name,
      'category', payload.category,
      'unit', payload.unit,
      'supplier_id', supplier_row.id,
      'opening_quantity', payload.current_quantity
    );
    insert into public.inventory_events (
      restaurant_id,
      inventory_item_id,
      event_type,
      quantity,
      canonical_unit,
      effective_at,
      actor_user_id,
      source,
      client_event_id,
      idempotency_key,
      metadata
    ) values (
      p_restaurant_id,
      item_row.id,
      'count',
      payload.current_quantity * item_row.canonical_quantity_per_unit,
      item_row.canonical_unit,
      clock_timestamp(),
      p_actor_user_id,
      'create_inventory_item',
      stable_event_key,
      stable_event_key,
      event_metadata
    );
    opening_ledgered := true;
    select * into item_row
    from public.inventory_items item
    where item.restaurant_id = p_restaurant_id and item.id = item_row.id;
  end if;

  select state.planning_revision into commit_revision
  from private.restaurant_signal_state state
  where state.restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision,
    p_recommendations, p_insights, false, '{}'::jsonb
  );

  return to_jsonb(item_row) || jsonb_build_object(
    'quantity_before', 0,
    'quantity_changed', item_row.current_quantity <> 0,
    'created', true,
    'opening_ledgered', opening_ledgered
  );
end;
$$;

revoke all on function private.service_create_inventory_item_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
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
  'Service-owned inventory item create. Authenticated clients must call through operational-workflows. Opening stock uses inventory_events when canonical units are verified.';
