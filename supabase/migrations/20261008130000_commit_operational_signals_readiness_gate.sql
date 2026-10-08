-- Fail closed when persisting system purchase recommendations without pilot
-- canRecommend. Insights still replace; pending mise_rules / legacy_client rows
-- are cleared by the empty recommendation set. Mirrors the application-layer
-- generation gate (empty recommendations, keep insights).
--
-- Alone-OK on main: includes evaluate_pilot_can_recommend (same contract as
-- 20261008120000_pilot_recommend_readiness_rpc_gate) so POS sync / count /
-- recipe mutations cannot persist Edge recommendations through
-- service_commit_operational_signals without verified readiness.
-- Does not wrap approve/create purchase RPCs — that remains the
-- pilot_recommend_readiness_rpc_gate tip.

-- Shared evaluate_pilot_can_recommend helper (same contract as the purchase
-- RPC readiness tip). Mirrors services/domain/pilotReadiness.ts recommendation
-- areas (POS, counts, recipe coverage) for server-side canRecommend decisions.

create or replace function private.normalize_pilot_match_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Pin identity folding to ASCII C so locale-sensitive lower() cannot
  -- collapse distinct POS provider tokens (e.g. Kelvin-sign lookalikes).
  select pg_catalog.lower(
    btrim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')) collate "C"
  );
$$;

revoke all on function private.normalize_pilot_match_text(text)
from public, anon, authenticated, service_role;

create or replace function private.sale_requires_provider_identity(
  p_source_pos text,
  p_provider_location_id text,
  p_provider_catalog_item_id text,
  p_provider_variation_id text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.normalize_pilot_match_text(p_source_pos) in ('square', 'toast', 'clover', 'lightspeed')
    or nullif(trim(coalesce(p_provider_location_id, '')), '') is not null
    or nullif(trim(coalesce(p_provider_catalog_item_id, '')), '') is not null
    or nullif(trim(coalesce(p_provider_variation_id, '')), '') is not null;
$$;

revoke all on function private.sale_requires_provider_identity(text, text, text, text)
from public, anon, authenticated, service_role;

create or replace function private.evaluate_pilot_can_recommend(
  p_restaurant_id uuid,
  p_evaluated_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluated_at timestamptz := coalesce(p_evaluated_at, clock_timestamp());
  minimum_sales_days integer := 7;
  minimum_recipe_coverage numeric := 0.9;
  maximum_count_age_hours numeric := 36;
  connected_integrations integer := 0;
  sales_rows integer := 0;
  sales_days integer := 0;
  latest_sync_at timestamptz;
  pos_status text := 'ready';
  pos_blockers text[] := array[]::text[];
  inventory_items integer := 0;
  counted_items integer := 0;
  fresh_counted_items integer := 0;
  verified_canonical_units integer := 0;
  missing_count_items integer := 0;
  stale_count_items integer := 0;
  unverified_unit_items integer := 0;
  inventory_status text := 'ready';
  inventory_blockers text[] := array[]::text[];
  total_sales_quantity numeric := 0;
  mapped_sales_quantity numeric := 0;
  coverage numeric := 0;
  recipe_mappings integer := 0;
  recipe_status text := 'ready';
  recipe_blockers text[] := array[]::text[];
  can_recommend boolean := false;
begin
  if p_restaurant_id is null then
    raise exception 'Pilot readiness requires a restaurant id.' using errcode = '22023';
  end if;

  select
    count(*) filter (where integration.status = 'connected'),
    max(integration.last_sync_at) filter (where integration.status = 'connected')
  into connected_integrations, latest_sync_at
  from public.pos_integrations integration
  where integration.restaurant_id = p_restaurant_id;

  select count(*), count(distinct sale.sale_date)
  into sales_rows, sales_days
  from public.pos_sales sale
  where sale.restaurant_id = p_restaurant_id;

  if connected_integrations = 0 then
    pos_status := 'external';
    pos_blockers := array['No connected POS integration was found.'];
  elsif sales_rows = 0 then
    pos_status := 'blocked';
    pos_blockers := array['Run a historical sales sync before generating recommendations.'];
  else
    if sales_days < minimum_sales_days then
      pos_blockers := array_append(
        pos_blockers,
        format('Only %s of %s required sales days are available.', sales_days, minimum_sales_days)
      );
    end if;
    if latest_sync_at is null
      or extract(epoch from (evaluated_at - latest_sync_at)) / 3600.0 > 24
    then
      pos_blockers := array_append(
        pos_blockers,
        'The latest connected POS sync is more than 24 hours old or unverified.'
      );
    end if;
    pos_status := case when cardinality(pos_blockers) = 0 then 'ready' else 'attention' end;
  end if;

  select count(*) into inventory_items
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id;

  if inventory_items = 0 then
    inventory_status := 'blocked';
    inventory_blockers := array['Add inventory items and complete a physical count.'];
  else
    select
      count(*) filter (
        where latest.effective_at is null
      ),
      count(*) filter (
        where latest.effective_at is not null
          and extract(epoch from (evaluated_at - latest.effective_at)) / 3600.0 > maximum_count_age_hours
      ),
      count(*) filter (
        where item.canonical_unit_verification_status <> 'verified'
      ),
      count(*) filter (where latest.effective_at is not null),
      count(*) filter (
        where latest.effective_at is not null
          and extract(epoch from (evaluated_at - latest.effective_at)) / 3600.0 <= maximum_count_age_hours
      ),
      count(*) filter (where item.canonical_unit_verification_status = 'verified')
    into
      missing_count_items,
      stale_count_items,
      unverified_unit_items,
      counted_items,
      fresh_counted_items,
      verified_canonical_units
    from public.inventory_items item
    left join lateral (
      select event.effective_at
      from public.inventory_events event
      where event.restaurant_id = item.restaurant_id
        and event.inventory_item_id = item.id
        and event.event_type = 'count'
      order by event.effective_at desc, event.sequence desc
      limit 1
    ) latest on true
    where item.restaurant_id = p_restaurant_id;

    if missing_count_items > 0 then
      inventory_blockers := array_append(
        inventory_blockers,
        format('%s inventory items have no physical-count evidence.', missing_count_items)
      );
    end if;
    if unverified_unit_items > 0 then
      inventory_blockers := array_append(
        inventory_blockers,
        format('%s inventory items have unverified canonical units.', unverified_unit_items)
      );
    end if;
    if stale_count_items > 0 then
      inventory_blockers := array_append(
        inventory_blockers,
        format('%s inventory counts are older than %s hours.', stale_count_items, maximum_count_age_hours)
      );
    end if;
    inventory_status := case
      when missing_count_items > 0 or unverified_unit_items > 0 then 'blocked'
      when stale_count_items > 0 then 'attention'
      else 'ready'
    end;
  end if;

  select count(*) into recipe_mappings
  from public.menu_item_ingredients mapping
  where mapping.restaurant_id = p_restaurant_id;

  select
    coalesce(sum(greatest(sale.quantity_sold, 0)), 0),
    coalesce(sum(
      case
        when greatest(sale.quantity_sold, 0) <= 0 then 0
        when private.sale_requires_provider_identity(
          sale.source_pos,
          sale.provider_location_id,
          sale.provider_catalog_item_id,
          sale.provider_variation_id
        ) then case
          when exists (
            select 1
            from public.pos_catalog_item_mappings mapping
            join public.pos_locations location
              on location.restaurant_id = mapping.restaurant_id
             and location.id = mapping.pos_location_id
            join public.menu_item_ingredients recipe
              on recipe.restaurant_id = mapping.restaurant_id
             and recipe.menu_item_id = mapping.menu_item_id
            where mapping.restaurant_id = sale.restaurant_id
              and mapping.verification_status = 'verified'
              and (mapping.effective_to is null or mapping.effective_to > evaluated_at)
              and mapping.effective_from <= evaluated_at
              and private.normalize_pilot_match_text(location.external_location_id)
                = private.normalize_pilot_match_text(sale.provider_location_id)
              and mapping.external_variation_id = sale.provider_variation_id
              and (
                sale.provider_catalog_item_id is null
                or mapping.external_catalog_item_id = sale.provider_catalog_item_id
              )
              and private.normalize_pilot_match_text(sale.source_pos) = any (array[
                'square', 'toast', 'clover', 'lightspeed'
              ])
          ) then greatest(sale.quantity_sold, 0)
          else 0
        end
        when exists (
          select 1
          from public.menu_item_ingredients recipe
          where recipe.restaurant_id = sale.restaurant_id
            and private.normalize_pilot_match_text(recipe.menu_item_name)
              = private.normalize_pilot_match_text(sale.item_name)
        ) then greatest(sale.quantity_sold, 0)
        else 0
      end
    ), 0)
  into total_sales_quantity, mapped_sales_quantity
  from public.pos_sales sale
  where sale.restaurant_id = p_restaurant_id;

  coverage := case
    when total_sales_quantity > 0 then mapped_sales_quantity / total_sales_quantity
    else 0
  end;

  if total_sales_quantity = 0 or mapped_sales_quantity = 0 then
    recipe_status := 'blocked';
  elsif coverage >= minimum_recipe_coverage then
    recipe_status := 'ready';
  else
    recipe_status := 'attention';
  end if;

  if coverage < minimum_recipe_coverage then
    recipe_blockers := array_append(
      recipe_blockers,
      format(
        'Recipe coverage is %s%%; %s%% is required.',
        round(coverage * 100),
        round(minimum_recipe_coverage * 100)
      )
    );
  end if;

  can_recommend := pos_status = 'ready'
    and inventory_status = 'ready'
    and recipe_status = 'ready';

  return jsonb_build_object(
    'restaurantId', p_restaurant_id,
    'evaluatedAt', evaluated_at,
    'canRecommend', can_recommend,
    'areas', jsonb_build_object(
      'pos_sales', jsonb_build_object(
        'status', pos_status,
        'blockers', to_jsonb(pos_blockers),
        'metrics', jsonb_build_object(
          'connectedIntegrations', connected_integrations,
          'salesRows', sales_rows,
          'salesDays', sales_days
        )
      ),
      'inventory_counts', jsonb_build_object(
        'status', inventory_status,
        'blockers', to_jsonb(inventory_blockers),
        'metrics', jsonb_build_object(
          'inventoryItems', inventory_items,
          'countedItems', counted_items,
          'freshCountedItems', fresh_counted_items,
          'verifiedCanonicalUnits', verified_canonical_units
        )
      ),
      'recipe_coverage', jsonb_build_object(
        'status', recipe_status,
        'blockers', to_jsonb(recipe_blockers),
        'metrics', jsonb_build_object(
          'recipeMappings', recipe_mappings,
          'mappedSalesQuantity', mapped_sales_quantity,
          'totalSalesQuantity', total_sales_quantity,
          'coveragePercent', round(coverage * 100)
        )
      )
    )
  );
end;
$$;

revoke all on function private.evaluate_pilot_can_recommend(uuid, timestamptz)
from public, anon, authenticated, service_role;


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
  -- Insights still replace; emptying recommendations also clears stale
  -- mise_rules / legacy_client pending rows via the delete below.
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
