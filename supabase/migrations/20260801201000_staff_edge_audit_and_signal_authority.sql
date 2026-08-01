-- Align SQL authority with Edge staff operational actions.
-- Staff may record waste (snapshot + signal commit), and Edge must be able to
-- audit staff-authorized workflows without failing after a successful mutation.

create or replace function private.fetch_operational_planning_snapshot(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  operating_date date;
begin
  -- Service-role only. Staff need snapshots for waste signal refresh; Edge still
  -- gates which mutations staff may perform.
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending')
  on conflict (restaurant_id) do nothing;
  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := current_date;
  end;

  return jsonb_build_object(
    'revision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
    'inventoryItems', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.item_name, item.id)
      from public.inventory_items item where item.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.sale_date desc, sale.item_name, sale.id)
      from (
        select * from public.pos_sales
        where restaurant_id = p_restaurant_id
        order by sale_date desc, id
        limit 2000
      ) sale
    ), '[]'::jsonb),
    'menuItemIngredients', coalesce((
      select jsonb_agg(to_jsonb(mapping) order by mapping.menu_item_name, mapping.id)
      from public.menu_item_ingredients mapping where mapping.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'recommendationHistory', coalesce((
      select jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at desc, recommendation.id)
      from (
        select * from public.purchase_recommendations
        where restaurant_id = p_restaurant_id and status <> 'pending'
        order by created_at desc, id
        limit 500
      ) recommendation
    ), '[]'::jsonb),
    'appliedTodayConsumptionByItemId', coalesce((
      select jsonb_object_agg(inventory_item_id::text, consumed)
      from (
        select
          movement.inventory_item_id,
          round(sum(greatest(0, movement.quantity_before - movement.quantity_after)), 4) as consumed
        from public.inventory_movements movement
        where movement.restaurant_id = p_restaurant_id
          and movement.reason in ('recipe_consumption', 'pos_consumption')
          and (movement.metadata->>'sale_date')::date = coalesce(operating_date, current_date)
        group by movement.inventory_item_id
      ) applied
    ), '{}'::jsonb)
  );
end;
$$;

create or replace function private.commit_operational_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb,
  p_complete_setup boolean default false,
  p_setup_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  safe_recommendations jsonb := coalesce(p_recommendations, '[]'::jsonb);
  safe_insights jsonb := coalesce(p_insights, '[]'::jsonb);
  safe_setup_metadata jsonb := coalesce(p_setup_metadata, '{}'::jsonb);
  inserted_recommendations integer;
  inserted_insights integer;
begin
  -- Staff may commit signals only as a side effect of staff-authorized mutations
  -- (today: record_waste). Edge still rejects staff for refresh_signals / setup /
  -- manager inventory edits before this RPC is invoked.
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_recommendations) <> 'array'
     or jsonb_typeof(safe_insights) <> 'array'
     or jsonb_array_length(safe_recommendations) > 250
     or jsonb_array_length(safe_insights) > 50 then
    raise exception 'Operational signal payload is outside supported limits' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_setup_metadata) <> 'object' or octet_length(safe_setup_metadata::text) > 8192 then
    raise exception 'Setup metadata must be a bounded object' using errcode = '22023';
  end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id
  for update;
  if not found or current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(safe_recommendations) payload(
      inventory_item_id uuid, recommended_quantity numeric, reason text, urgency text
    )
    left join public.inventory_items item
      on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
    where item.id is null
      or payload.recommended_quantity is null
      or payload.recommended_quantity <= 0
      or payload.recommended_quantity > 1000000
      or payload.urgency not in ('low', 'medium', 'high')
      or length(trim(payload.reason)) not between 1 and 2000
  ) then
    raise exception 'Generated recommendation payload is invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(safe_insights) payload(
      insight_type text, title text, description text, why_it_matters text,
      recommended_action text, severity text
    )
    where payload.insight_type not in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
      or payload.severity not in ('info', 'warning', 'urgent')
      or length(trim(payload.title)) not between 1 and 240
      or length(trim(payload.description)) not between 1 and 4000
      or length(trim(payload.recommended_action)) not between 1 and 2000
      or (payload.why_it_matters is not null and length(payload.why_it_matters) > 2000)
  ) then
    raise exception 'Generated insight payload is invalid' using errcode = '22023';
  end if;

  delete from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and status = 'pending'
    and generation_source in ('mise_rules', 'legacy_client');

  insert into public.purchase_recommendations (
    restaurant_id, inventory_item_id, item_name, supplier_name,
    recommended_quantity, unit, reason, urgency, status, supplier_order_id,
    generation_source, planning_revision
  )
  select
    p_restaurant_id, item.id, item.item_name, item.supplier_name,
    payload.recommended_quantity, item.unit, trim(payload.reason), payload.urgency,
    'pending', null, 'mise_rules', current_revision
  from jsonb_to_recordset(safe_recommendations) payload(
    inventory_item_id uuid, recommended_quantity numeric, reason text, urgency text
  )
  join public.inventory_items item
    on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
  where not exists (
    select 1 from public.purchase_recommendations manual
    where manual.restaurant_id = p_restaurant_id
      and manual.inventory_item_id = item.id
      and manual.status = 'pending'
      and manual.generation_source = 'manual'
  );
  get diagnostics inserted_recommendations = row_count;

  delete from public.insights where restaurant_id = p_restaurant_id;
  insert into public.insights (
    restaurant_id, insight_type, title, description, why_it_matters,
    recommended_action, severity, generation_source, planning_revision
  )
  select
    p_restaurant_id, payload.insight_type, trim(payload.title), trim(payload.description),
    nullif(trim(payload.why_it_matters), ''), trim(payload.recommended_action), payload.severity,
    'mise_rules', current_revision
  from jsonb_to_recordset(safe_insights) payload(
    insight_type text, title text, description text, why_it_matters text,
    recommended_action text, severity text
  );
  get diagnostics inserted_insights = row_count;

  update private.restaurant_signal_state
  set signals_revision = current_revision, status = 'current', updated_at = now()
  where restaurant_id = p_restaurant_id;

  if p_complete_setup and not exists (
    select 1 from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
      and audit.metadata->>'setup_fingerprint' = safe_setup_metadata->>'setup_fingerprint'
  ) then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, p_actor_user_id, 'setup_completed', 'restaurants', p_restaurant_id,
      safe_setup_metadata || jsonb_build_object('signals_revision', current_revision)
    );
  end if;

  return jsonb_build_object(
    'planning_revision', current_revision,
    'signals_status', 'current',
    'recommendations', inserted_recommendations,
    'insights', inserted_insights
  );
end;
$$;

create or replace function private.service_record_edge_audit_log(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_action text,
  p_entity_table text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.audit_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_log public.audit_logs;
  allowed_roles text[] := array['owner', 'admin', 'manager'];
  staff_audit_actions text[] := array[
    'inventory_waste_recorded',
    'inventory_transfer_recorded',
    'inventory_count_session_started',
    'inventory_count_lines_saved',
    'inventory_count_session_submitted',
    'operator_profile_updated',
    'operator_locale_updated'
  ];
begin
  if p_action is not null and p_action = any (staff_audit_actions) then
    allowed_roles := array['owner', 'admin', 'manager', 'staff'];
  end if;

  if p_actor_user_id is null or p_restaurant_id is null
    or not private.actor_has_restaurant_role(
      p_actor_user_id,
      p_restaurant_id,
      allowed_roles
    )
  then
    raise exception 'Restaurant audit access denied' using errcode = '42501';
  end if;
  if p_action is null or pg_catalog.length(p_action) not between 1 and 120
    or p_entity_table is null or pg_catalog.length(p_entity_table) not between 1 and 120
    or p_metadata is null or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or pg_catalog.octet_length(p_metadata::text) > 8192
  then
    raise exception 'Audit event is invalid' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, p_action, p_entity_table, p_entity_id, p_metadata
  )
  returning * into created_log;
  return created_log;
end;
$$;

comment on function private.fetch_operational_planning_snapshot(uuid, uuid) is
  'Service-owned planning snapshot for owner/admin/manager/staff. Edge enforces which mutations staff may run.';
comment on function private.commit_operational_signals(uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb) is
  'Service-owned signal commit for owner/admin/manager/staff. Staff use is limited to staff-authorized mutation side effects.';
comment on function private.service_record_edge_audit_log(uuid, uuid, text, text, uuid, jsonb) is
  'Service-owned Edge audit write. Staff actors may only persist staff-authorized action names.';
