-- Server-side pilot canRecommend gate for purchase recommendation write paths.
-- Mirrors services/domain/pilotReadiness.ts recommendation areas (POS, counts,
-- recipe coverage) so clients cannot bypass the application-layer readiness
-- checks by calling approve / create_pending RPCs directly.

create or replace function private.normalize_pilot_match_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')));
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

create or replace function private.require_pilot_can_recommend(
  p_restaurant_id uuid,
  p_evaluated_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  readiness jsonb;
begin
  readiness := private.evaluate_pilot_can_recommend(p_restaurant_id, p_evaluated_at);
  if coalesce((readiness->>'canRecommend')::boolean, false) is not true then
    raise exception 'Pilot readiness is incomplete for purchase recommendations.'
      using errcode = '22023',
            detail = left(coalesce(readiness::text, ''), 2000);
  end if;
  return readiness;
end;
$$;

revoke all on function private.require_pilot_can_recommend(uuid, timestamptz)
from public, anon, authenticated, service_role;

alter function public.approve_purchase_recommendation(uuid, uuid, numeric)
  rename to approve_purchase_recommendation_pre_pilot_readiness;
alter function public.approve_purchase_recommendation_pre_pilot_readiness(uuid, uuid, numeric)
  set schema private;

revoke all on function private.approve_purchase_recommendation_pre_pilot_readiness(uuid, uuid, numeric)
from public, anon, authenticated, service_role;

create function public.approve_purchase_recommendation(
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

alter function public.create_pending_purchase_recommendation(uuid, uuid, numeric, text, text)
  rename to create_pending_purchase_recommendation_pre_pilot_readiness;
alter function public.create_pending_purchase_recommendation_pre_pilot_readiness(
  uuid, uuid, numeric, text, text
) set schema private;

revoke all on function private.create_pending_purchase_recommendation_pre_pilot_readiness(
  uuid, uuid, numeric, text, text
) from public, anon, authenticated, service_role;

create function public.create_pending_purchase_recommendation(
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
