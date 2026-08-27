-- Fail closed when persisting system purchase recommendations without pilot
-- canRecommend. Insights still replace; pending mise_rules / legacy_client rows
-- are cleared by the empty recommendation set. Mirrors the application-layer
-- generation gate (empty recommendations, keep insights).
--
-- Also authorize purchase RPC wrappers before evaluating readiness so blocked-
-- readiness exception detail cannot disclose another restaurant's metrics.

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
  readiness jsonb;
  can_recommend boolean := false;
  inserted_recommendations integer;
  inserted_insights integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
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

  -- Authorize first (above), then evaluate. Never invent recommendations when
  -- readiness is incomplete or unverifiable — publish an empty pending set.
  readiness := private.evaluate_pilot_can_recommend(p_restaurant_id);
  can_recommend := coalesce((readiness->>'canRecommend')::boolean, false);
  if can_recommend is not true then
    safe_recommendations := '[]'::jsonb;
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

revoke all on function private.commit_operational_signals(
  uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb
) from public, anon, authenticated;
grant execute on function private.commit_operational_signals(
  uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb
) to service_role;

-- Authorize before readiness evaluation so exception detail cannot leak
-- another restaurant's POS / count / recipe metrics to an unauthorized caller.
create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_snapshot public.purchase_recommendations%rowtype;
  result jsonb;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into recommendation_snapshot
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then
    raise exception 'Recommendation not found' using errcode = 'P0002';
  end if;

  -- Idempotent replays and terminal states keep the prior authority path.
  -- Pending approvals must revalidate restaurant-level pilot readiness first.
  if recommendation_snapshot.status = 'pending' then
    perform private.require_pilot_can_recommend(p_restaurant_id);
  end if;

  result := private.approve_purchase_recommendation_pre_pilot_readiness(
    p_restaurant_id,
    p_recommendation_id,
    p_recommended_quantity
  );
  return result;
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
to authenticated;

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
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  -- Fail closed before creating or replacing pending purchase recommendations.
  perform private.require_pilot_can_recommend(p_restaurant_id);
  return private.create_pending_purchase_recommendation_pre_pilot_readiness(
    p_restaurant_id,
    p_inventory_item_id,
    p_recommended_quantity,
    p_reason,
    p_urgency
  );
end;
$$;

revoke all on function public.create_pending_purchase_recommendation(
  uuid, uuid, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_pending_purchase_recommendation(
  uuid, uuid, numeric, text, text
) to authenticated;
