-- Make workflow state and security evidence server-owned.
-- Client roles keep tenant-scoped read access, while narrowly-scoped RPCs are
-- the only supported mutation surface for recommendations, supplier orders,
-- operational insights, and semantic audit/security events.

-- Business bounds are enforced in PostgreSQL as well as in the Expo client.
alter table public.inventory_items
  drop constraint if exists inventory_items_operational_values_check;
alter table public.inventory_items
  add constraint inventory_items_operational_values_check check (
    length(trim(item_name)) between 1 and 160 and
    length(trim(unit)) between 1 and 40 and
    length(trim(supplier_name)) between 1 and 160 and
    current_quantity between 0 and 1000000 and
    par_level between 0 and 1000000 and
    reorder_threshold between 0 and 1000000 and
    estimated_unit_cost between 0 and 1000000
  );

alter table public.menu_item_ingredients
  drop constraint if exists menu_item_ingredients_quantity_used_per_sale_check;
alter table public.menu_item_ingredients
  add constraint menu_item_ingredients_quantity_used_per_sale_check check (
    quantity_used_per_sale between 0 and 10000
  );

alter table public.pos_sales
  add constraint pos_sales_operational_values_check check (
    length(trim(item_name)) between 1 and 200 and
    length(trim(category)) between 1 and 120 and
    quantity_sold between 0 and 100000 and
    gross_sales between 0 and 10000000 and
    net_sales between 0 and 10000000
  );

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_operational_values_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_operational_values_check check (
    length(trim(item_name)) between 1 and 160 and
    length(trim(supplier_name)) between 1 and 160 and
    length(trim(unit)) between 1 and 40 and
    length(trim(reason)) between 1 and 2000 and
    recommended_quantity > 0 and
    recommended_quantity <= 1000000
  );

alter table public.insights
  add constraint insights_content_bounds_check check (
    length(trim(title)) between 1 and 240 and
    length(trim(description)) between 1 and 4000 and
    length(trim(recommended_action)) between 1 and 2000 and
    (why_it_matters is null or length(why_it_matters) <= 2000)
  );

-- Existing order RPCs already perform explicit role checks, lock affected rows,
-- use an empty search_path, and derive audit semantics. Run them with the
-- migration owner so authenticated callers no longer need direct DML grants.
alter function public.approve_purchase_recommendation(uuid, uuid, numeric) security definer;
alter function public.dismiss_purchase_recommendation(uuid, uuid) security definer;
alter function public.undo_purchase_recommendation_action(uuid, uuid) security definer;
alter function public.update_supplier_order_draft(uuid, uuid, text, boolean, date, boolean) security definer;
alter function public.mark_supplier_order_sent(uuid, uuid) security definer;

create or replace function public.create_pending_purchase_recommendation(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_recommended_quantity numeric,
  p_reason text,
  p_urgency text
)
returns public.purchase_recommendations
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is null or p_recommended_quantity <= 0 or p_recommended_quantity > 1000000 then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;
  if p_urgency not in ('low', 'medium', 'high') then
    raise exception 'Unsupported recommendation urgency' using errcode = '22023';
  end if;
  if nullif(trim(p_reason), '') is null or length(p_reason) > 2000 then
    raise exception 'Enter a valid recommendation reason' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || p_inventory_item_id::text, 0)
  );

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id;
  if not found then raise exception 'Inventory item not found'; end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and status = 'pending'
  for update;

  if found then return recommendation_row; end if;

  insert into public.purchase_recommendations (
    restaurant_id,
    inventory_item_id,
    item_name,
    supplier_name,
    recommended_quantity,
    unit,
    reason,
    urgency,
    status,
    supplier_order_id
  ) values (
    p_restaurant_id,
    item_row.id,
    item_row.item_name,
    item_row.supplier_name,
    p_recommended_quantity,
    item_row.unit,
    trim(p_reason),
    p_urgency,
    'pending',
    null
  )
  returning * into recommendation_row;

  return recommendation_row;
end;
$$;

create or replace function public.replace_pending_purchase_recommendations(
  p_restaurant_id uuid,
  p_recommendations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_recommendations jsonb := coalesce(p_recommendations, '[]'::jsonb);
  recommendation_count integer;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_recommendations) <> 'array' then
    raise exception 'Recommendations must be a JSON array' using errcode = '22023';
  end if;

  recommendation_count := jsonb_array_length(safe_recommendations);
  if recommendation_count > 250 then
    raise exception 'Recommendation refresh is limited to 250 items' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || E'\x1frecommendations', 0));

  delete from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and status = 'pending';

  insert into public.purchase_recommendations (
    restaurant_id,
    inventory_item_id,
    item_name,
    supplier_name,
    recommended_quantity,
    unit,
    reason,
    urgency,
    status,
    supplier_order_id
  )
  select
    p_restaurant_id,
    item.id,
    item.item_name,
    item.supplier_name,
    payload.recommended_quantity,
    item.unit,
    trim(payload.reason),
    payload.urgency,
    'pending',
    null
  from jsonb_to_recordset(safe_recommendations) as payload(
    inventory_item_id uuid,
    recommended_quantity numeric,
    reason text,
    urgency text
  )
  join public.inventory_items item
    on item.restaurant_id = p_restaurant_id
   and item.id = payload.inventory_item_id
  where payload.recommended_quantity > 0
    and payload.recommended_quantity <= 1000000
    and payload.urgency in ('low', 'medium', 'high')
    and length(trim(payload.reason)) between 1 and 2000;

  if (select count(*) from public.purchase_recommendations where restaurant_id = p_restaurant_id and status = 'pending')
     <> recommendation_count then
    raise exception 'One or more recommendations were invalid or outside this restaurant' using errcode = '22023';
  end if;

  return jsonb_build_object('replaced', recommendation_count);
end;
$$;

create or replace function public.replace_operational_insights(
  p_restaurant_id uuid,
  p_insights jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_insights jsonb := coalesce(p_insights, '[]'::jsonb);
  insight_count integer;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_insights) <> 'array' then
    raise exception 'Insights must be a JSON array' using errcode = '22023';
  end if;

  insight_count := jsonb_array_length(safe_insights);
  if insight_count > 50 then
    raise exception 'Insight refresh is limited to 50 items' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || E'\x1finsights', 0));

  delete from public.insights where restaurant_id = p_restaurant_id;
  insert into public.insights (
    restaurant_id,
    insight_type,
    title,
    description,
    why_it_matters,
    recommended_action,
    severity
  )
  select
    p_restaurant_id,
    payload.insight_type,
    trim(payload.title),
    trim(payload.description),
    nullif(trim(payload.why_it_matters), ''),
    trim(payload.recommended_action),
    payload.severity
  from jsonb_to_recordset(safe_insights) as payload(
    insight_type text,
    title text,
    description text,
    why_it_matters text,
    recommended_action text,
    severity text
  )
  where payload.insight_type in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
    and payload.severity in ('info', 'warning', 'urgent')
    and length(trim(payload.title)) between 1 and 240
    and length(trim(payload.description)) between 1 and 4000
    and length(trim(payload.recommended_action)) between 1 and 2000
    and (payload.why_it_matters is null or length(payload.why_it_matters) <= 2000);

  if (select count(*) from public.insights where restaurant_id = p_restaurant_id) <> insight_count then
    raise exception 'One or more insights were invalid' using errcode = '22023';
  end if;

  return jsonb_build_object('replaced', insight_count);
end;
$$;

create or replace function public.record_setup_completion_audit(
  p_restaurant_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  normalized_metadata jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;

  normalized_metadata := jsonb_build_object(
    'inventory_items_saved', least(greatest(coalesce((safe_metadata->>'inventory_items_saved')::integer, 0), 0), 10000),
    'supplier_recipients_saved', least(greatest(coalesce((safe_metadata->>'supplier_recipients_saved')::integer, 0), 0), 10000),
    'recipe_mappings_saved', least(greatest(coalesce((safe_metadata->>'recipe_mappings_saved')::integer, 0), 0), 10000),
    'pos_sales_rows_saved', least(greatest(coalesce((safe_metadata->>'pos_sales_rows_saved')::integer, 0), 0), 10000),
    'attachment_metadata_saved', least(greatest(coalesce((safe_metadata->>'attachment_metadata_saved')::integer, 0), 0), 10000),
    'skipped_recipe_ingredients', least(greatest(coalesce((safe_metadata->>'skipped_recipe_ingredients')::integer, 0), 0), 10000)
  );

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_restaurant_id,
    auth.uid(),
    'setup_completed',
    'restaurants',
    p_restaurant_id,
    normalized_metadata
  );

  return true;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Setup audit metadata must contain bounded integer counts' using errcode = '22023';
end;
$$;

-- Remove direct mutation policies and grants. Reads remain governed by the
-- existing restaurant-membership RLS policies.
drop policy if exists "Managers can insert recommendations" on public.purchase_recommendations;
drop policy if exists "Managers can update recommendations" on public.purchase_recommendations;
drop policy if exists "Owners and admins can delete recommendations" on public.purchase_recommendations;
drop policy if exists "Managers can insert supplier orders" on public.supplier_orders;
drop policy if exists "Managers can update supplier orders" on public.supplier_orders;
drop policy if exists "Owners and admins can delete supplier orders" on public.supplier_orders;
drop policy if exists "Managers can delete draft supplier orders" on public.supplier_orders;
drop policy if exists "Managers can insert insights" on public.insights;
drop policy if exists "Managers can update insights" on public.insights;
drop policy if exists "Owners and admins can delete insights" on public.insights;
drop policy if exists "Managers can insert audit logs" on public.audit_logs;

revoke insert, update, delete on public.purchase_recommendations from authenticated;
revoke insert, update, delete on public.supplier_orders from authenticated;
revoke insert, update, delete on public.insights from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
grant select on public.purchase_recommendations, public.supplier_orders, public.insights to authenticated;
grant insert on public.audit_logs to service_role;

revoke all on function public.create_pending_purchase_recommendation(uuid, uuid, numeric, text, text) from public, anon, authenticated;
revoke all on function public.replace_pending_purchase_recommendations(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.replace_operational_insights(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.record_setup_completion_audit(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_pending_purchase_recommendation(uuid, uuid, numeric, text, text) to authenticated;
grant execute on function public.replace_pending_purchase_recommendations(uuid, jsonb) to authenticated;
grant execute on function public.replace_operational_insights(uuid, jsonb) to authenticated;
grant execute on function public.record_setup_completion_audit(uuid, jsonb) to authenticated;

-- Every terminal Edge event must belong to one allowed reservation.
alter table private.edge_function_security_events
  add column if not exists reservation_id uuid
  references private.edge_function_security_events(id) on delete cascade;
create unique index if not exists edge_function_security_events_terminal_once_idx
  on private.edge_function_security_events(reservation_id)
  where reservation_id is not null;

revoke all on function public.reserve_edge_function_invocation(uuid, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.record_edge_function_security_event(uuid, text, text, text, jsonb) from public, anon, authenticated, service_role;
drop function public.reserve_edge_function_invocation(uuid, text, text, jsonb);
drop function public.record_edge_function_security_event(uuid, text, text, text, jsonb);

create function public.reserve_edge_function_invocation(
  target_restaurant_id uuid,
  p_actor_user_id uuid,
  p_function_name text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_policy record;
  attempt_count integer;
  reservation_id uuid;
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
begin
  if p_actor_user_id is null or target_restaurant_id is null then
    raise exception 'Missing invocation authority' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_metadata) <> 'object' or octet_length(safe_metadata::text) > 8192 then
    raise exception 'Metadata must be a bounded JSON object' using errcode = '22023';
  end if;
  if nullif(trim(action_name), '') is null or length(action_name) > 160 then
    raise exception 'Invalid invocation action' using errcode = '22023';
  end if;

  select * into current_policy from private.edge_function_policy(p_function_name);
  if not found then raise exception 'Unsupported function' using errcode = '22023'; end if;

  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = target_restaurant_id
      and membership.user_id = p_actor_user_id
      and membership.status = 'active'
      and membership.role = any(current_policy.allowed_roles)
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    target_restaurant_id::text || E'\x1f' || p_actor_user_id::text || E'\x1f' || p_function_name,
    0
  ));

  select count(*)::integer into attempt_count
  from private.edge_function_security_events events
  where events.restaurant_id = target_restaurant_id
    and events.actor_user_id = p_actor_user_id
    and events.function_name = p_function_name
    and events.created_at >= now() - make_interval(secs => current_policy.window_seconds)
    and events.event_type in ('allowed', 'rate_limited');

  if attempt_count >= current_policy.max_attempts then
    insert into private.edge_function_security_events (
      restaurant_id, actor_user_id, function_name, event_type, action, metadata
    ) values (
      target_restaurant_id,
      p_actor_user_id,
      p_function_name,
      'rate_limited',
      trim(action_name),
      safe_metadata || jsonb_build_object(
        'window_seconds', current_policy.window_seconds,
        'max_attempts', current_policy.max_attempts
      )
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'retry_after_seconds', current_policy.window_seconds
    );
  end if;

  insert into private.edge_function_security_events (
    restaurant_id, actor_user_id, function_name, event_type, action, metadata
  ) values (
    target_restaurant_id,
    p_actor_user_id,
    p_function_name,
    'allowed',
    trim(action_name),
    safe_metadata
  ) returning id into reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reservation_id', reservation_id,
    'remaining', greatest(current_policy.max_attempts - attempt_count - 1, 0),
    'window_seconds', current_policy.window_seconds
  );
end;
$$;

create function public.record_edge_function_security_event(
  target_restaurant_id uuid,
  p_actor_user_id uuid,
  p_reservation_id uuid,
  p_function_name text,
  p_event_type text,
  action_name text,
  metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_metadata jsonb := coalesce(metadata, '{}'::jsonb);
  reservation_row private.edge_function_security_events%rowtype;
begin
  if p_event_type not in ('blocked', 'completed', 'error') then
    raise exception 'Unsupported security event type' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_metadata) <> 'object' or octet_length(safe_metadata::text) > 8192 then
    raise exception 'Metadata must be a bounded JSON object' using errcode = '22023';
  end if;
  if nullif(trim(action_name), '') is null or length(action_name) > 160 then
    raise exception 'Invalid security event action' using errcode = '22023';
  end if;

  select * into reservation_row
  from private.edge_function_security_events
  where id = p_reservation_id
    and restaurant_id = target_restaurant_id
    and actor_user_id = p_actor_user_id
    and function_name = p_function_name
    and event_type = 'allowed'
    and created_at >= now() - interval '15 minutes'
  for update;
  if not found then
    raise exception 'Invocation reservation not found or expired' using errcode = '22023';
  end if;

  insert into private.edge_function_security_events (
    restaurant_id,
    actor_user_id,
    function_name,
    event_type,
    action,
    metadata,
    reservation_id
  ) values (
    target_restaurant_id,
    p_actor_user_id,
    p_function_name,
    p_event_type,
    trim(action_name),
    safe_metadata,
    p_reservation_id
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.reserve_edge_function_invocation(uuid, uuid, text, text, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.record_edge_function_security_event(uuid, uuid, uuid, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.reserve_edge_function_invocation(uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.record_edge_function_security_event(uuid, uuid, uuid, text, text, text, jsonb) to service_role;

-- Adopt explicit opt-in grants for future public objects before Supabase's
-- October 2026 existing-project rollout.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
