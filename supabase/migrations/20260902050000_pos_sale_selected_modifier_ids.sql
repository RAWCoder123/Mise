-- Persist catalog-backed Square line-item modifier ids on pos_sales so verified
-- modifier_recipe_adjustments can fail closed into inventory depletion.
-- Does not invent deltas; ids are observational only until adjustments exist.

alter table public.pos_sales
  add column if not exists selected_modifier_ids text[] not null default '{}'::text[];

alter table public.pos_sales
  drop constraint if exists pos_sales_selected_modifier_ids_bound;

alter table public.pos_sales
  add constraint pos_sales_selected_modifier_ids_bound
  check (
    cardinality(selected_modifier_ids) <= 32
    and (
      selected_modifier_ids = '{}'::text[]
      or (
        array_position(selected_modifier_ids, null) is null
        and not exists (
          select 1
          from unnest(selected_modifier_ids) as modifier_id(value)
          where length(value) < 1
            or length(value) > 128
            or value ~ '[[:cntrl:]]'
        )
      )
    )
  );

comment on column public.pos_sales.selected_modifier_ids is
  'Bounded catalog-backed POS modifier ids on this sale line. Empty means base recipe depletion only.';

create or replace function private.normalize_selected_modifier_ids(p_value jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text[] := '{}'::text[];
  entry text;
  candidate text;
begin
  if p_value is null or jsonb_typeof(p_value) <> 'array' then
    return normalized;
  end if;

  for entry in
    select value
    from jsonb_array_elements_text(p_value)
  loop
    exit when cardinality(normalized) >= 32;
    candidate := left(trim(coalesce(entry, '')), 128);
    if candidate = '' or candidate ~ '[[:cntrl:]]' then
      continue;
    end if;
    if candidate = any (normalized) then
      continue;
    end if;
    normalized := array_append(normalized, candidate);
  end loop;

  return normalized;
end;
$$;

revoke all on function private.normalize_selected_modifier_ids(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.normalize_selected_modifier_ids(jsonb)
  to service_role;

create or replace function private.service_apply_square_sync_result_scoped(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sync_token uuid,
  p_snapshot_mode text,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date,
  p_modifier_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  integration public.pos_integrations%rowtype;
  prepared_sales jsonb;
  applied jsonb;
  import_id uuid;
  completed_at timestamptz;
  active_location_ids text[];
  modifier_summary jsonb := private.normalize_square_modifier_sync_summary(
    coalesce(p_modifier_summary, '{}'::jsonb)
  );
  sale jsonb;
  sale_source_record_id text;
  modifier_ids text[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sync_token is null or p_snapshot_mode not in ('full', 'partial')
    or p_from is null or p_to is null or p_to < p_from
  then
    raise exception 'Square sync completion boundary is invalid' using errcode = '22023';
  end if;

  select * into integration
  from public.pos_integrations candidate
  where candidate.id = p_integration_id
    and candidate.restaurant_id = p_restaurant_id
    and candidate.provider = 'square'
  for update;
  if not found then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;
  if integration.authority_sync_token is distinct from p_sync_token
    or integration.authority_sync_mode is distinct from p_snapshot_mode
    or integration.authority_sync_window_from is distinct from p_from
    or integration.authority_sync_window_to is distinct from p_to
  then
    raise exception 'Square sync boundary changed before completion' using errcode = '40001';
  end if;

  select coalesce(array_agg(location.external_location_id order by location.external_location_id), '{}')
  into active_location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active';
  if active_location_ids is distinct from integration.authority_sync_location_ids then
    raise exception 'Square active locations changed during synchronization' using errcode = '40001';
  end if;

  prepared_sales := private.prepare_square_sales_for_authority(
    p_restaurant_id,
    p_integration_id,
    p_sales,
    p_catalog_items,
    p_from,
    p_to,
    p_snapshot_mode = 'full'
  );

  applied := private.service_apply_square_sync_result_mise_003a_base(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    prepared_sales,
    p_catalog_items,
    p_sync_cursor,
    p_from,
    p_to
  );
  import_id := nullif(applied->>'importId', '')::uuid;
  completed_at := nullif(applied->>'authorityWindowCompletedAt', '')::timestamptz;

  -- Attach normalized modifier ids after the immutable 003a base insert path.
  for sale in select value from jsonb_array_elements(prepared_sales)
  loop
    sale_source_record_id := nullif(left(trim(coalesce(sale->>'source_record_id', '')), 200), '');
    if sale_source_record_id is null then
      continue;
    end if;
    modifier_ids := private.normalize_selected_modifier_ids(sale->'selected_modifier_ids');
    update public.pos_sales existing
    set selected_modifier_ids = modifier_ids
    where existing.restaurant_id = p_restaurant_id
      and existing.source_pos = 'Square'
      and existing.source_record_id = sale_source_record_id;
  end loop;

  select coalesce(array_agg(location.external_location_id order by location.external_location_id), '{}')
  into active_location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active';
  if active_location_ids is distinct from integration.authority_sync_location_ids then
    raise exception 'Square active locations changed during synchronization' using errcode = '40001';
  end if;

  update public.pos_integrations
  set authority_window_from = case when p_snapshot_mode = 'full' then p_from else null end,
    authority_window_to = case when p_snapshot_mode = 'full' then p_to else null end,
    authority_window_completed_at = case
      when p_snapshot_mode = 'full' then completed_at else null end,
    authority_sync_token = null,
    authority_sync_started_at = null,
    authority_sync_mode = null,
    authority_sync_window_from = null,
    authority_sync_window_to = null,
    authority_sync_location_ids = null,
    updated_at = coalesce(completed_at, clock_timestamp())
  where id = p_integration_id
    and restaurant_id = p_restaurant_id
    and authority_sync_token = p_sync_token;
  if not found then
    raise exception 'Square sync boundary changed during completion' using errcode = '40001';
  end if;

  if import_id is not null then
    update public.sales_imports
    set metadata = metadata || jsonb_build_object(
      'snapshot_mode', p_snapshot_mode,
      'authority_window_attested', p_snapshot_mode = 'full'
    ) || modifier_summary
    where id = import_id and restaurant_id = p_restaurant_id;
    update public.audit_logs
    set metadata = metadata || jsonb_build_object(
      'snapshot_mode', p_snapshot_mode,
      'authority_window_attested', p_snapshot_mode = 'full',
      'modifiers_observed_count', modifier_summary->'modifiers_observed_count',
      'modifiers_unique_count', modifier_summary->'modifiers_unique_count'
    )
    where restaurant_id = p_restaurant_id
      and entity_id = import_id
      and action = 'square_sync_completed';
  end if;

  return applied || jsonb_build_object(
    'snapshotMode', p_snapshot_mode,
    'authorityWindowAttested', p_snapshot_mode = 'full',
    'authorityWindowFrom', case when p_snapshot_mode = 'full' then to_jsonb(p_from) else 'null'::jsonb end,
    'authorityWindowTo', case when p_snapshot_mode = 'full' then to_jsonb(p_to) else 'null'::jsonb end,
    'authorityWindowCompletedAt', case
      when p_snapshot_mode = 'full' then to_jsonb(completed_at) else 'null'::jsonb end,
    'modifiersObservedCount', modifier_summary->'modifiers_observed_count',
    'modifiersUniqueCount', modifier_summary->'modifiers_unique_count',
    'modifiersSample', modifier_summary->'modifiers_sample'
  );
end;
$$;

revoke all on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) from public, anon, authenticated, service_role;
grant execute on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) to service_role;

create or replace function public.service_apply_square_sync_result_scoped(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sync_token uuid,
  p_snapshot_mode text,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date,
  p_modifier_summary jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_apply_square_sync_result_scoped(
    p_actor_user_id, p_restaurant_id, p_integration_id, p_sync_token,
    p_snapshot_mode, p_sales, p_catalog_items, p_sync_cursor, p_from, p_to,
    p_modifier_summary
  );
$$;

revoke all on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) to service_role;

-- Rebuild planning sales to return the new column. Lines with selected modifiers
-- stay unaggregated so depletion can apply verified deltas per sale line.
create or replace function public.fetch_planning_sales(
  p_restaurant_id uuid,
  p_service_days integer default 28
)
returns setof public.pos_sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  operating_date date;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_service_days is null or p_service_days not between 7 and 60 then
    raise exception 'Service-day window must be between 7 and 60 days' using errcode = '22023';
  end if;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant
    where restaurant.id = p_restaurant_id;
  exception
    when invalid_parameter_value then operating_date := current_date;
  end;
  operating_date := coalesce(operating_date, current_date);

  return query
  with historical_service_days as (
    select distinct sale.sale_date
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and sale.sale_date < operating_date
    order by sale.sale_date desc
    limit p_service_days
  ),
  windowed_sales as (
    select *
    from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and (
        sale.sale_date = operating_date
        or sale.sale_date in (select day.sale_date from historical_service_days day)
      )
  ),
  provider_complete as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      min(sale.source_pos) as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      '{}'::text[] as selected_modifier_ids
    from windowed_sales sale
    where (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and sale.provider_location_id is not null
      and sale.provider_catalog_item_id is not null
      and sale.provider_variation_id is not null
      and cardinality(coalesce(sale.selected_modifier_ids, '{}'::text[])) = 0
    group by sale.sale_date, sale.source_pos, sale.provider_location_id, sale.provider_catalog_item_id, sale.provider_variation_id, sale.item_name, sale.category
  ),
  provider_complete_with_modifiers as (
    select
      sale.id,
      sale.restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sale.quantity_sold,
      sale.gross_sales,
      sale.net_sales,
      sale.source_pos,
      sale.created_at,
      sale.source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      coalesce(sale.selected_modifier_ids, '{}'::text[]) as selected_modifier_ids
    from windowed_sales sale
    where (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and sale.provider_location_id is not null
      and sale.provider_catalog_item_id is not null
      and sale.provider_variation_id is not null
      and cardinality(coalesce(sale.selected_modifier_ids, '{}'::text[])) > 0
  ),
  provider_incomplete as (
    select
      sale.id,
      sale.restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sale.quantity_sold,
      sale.gross_sales,
      sale.net_sales,
      sale.source_pos,
      sale.created_at,
      sale.source_record_id,
      sale.provider_catalog_item_id,
      sale.provider_location_id,
      sale.provider_variation_id,
      coalesce(sale.selected_modifier_ids, '{}'::text[]) as selected_modifier_ids
    from windowed_sales sale
    where (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and not (
        sale.provider_location_id is not null
        and sale.provider_catalog_item_id is not null
        and sale.provider_variation_id is not null
      )
  ),
  manual_sales as (
    select
      (array_agg(sale.id order by sale.id))[1] as id,
      p_restaurant_id as restaurant_id,
      sale.sale_date,
      sale.item_name,
      sale.category,
      sum(sale.quantity_sold) as quantity_sold,
      sum(sale.gross_sales) as gross_sales,
      sum(sale.net_sales) as net_sales,
      case
        when count(distinct sale.source_pos) = 1 then min(sale.source_pos)
        else 'Mise aggregate'
      end as source_pos,
      max(sale.created_at) as created_at,
      null::text as source_record_id,
      null::text as provider_catalog_item_id,
      null::text as provider_location_id,
      null::text as provider_variation_id,
      '{}'::text[] as selected_modifier_ids
    from windowed_sales sale
    where not (
      lower(coalesce(sale.source_pos, '')) in ('square', 'toast', 'clover', 'lightspeed')
      or sale.provider_location_id is not null
      or sale.provider_catalog_item_id is not null
      or sale.provider_variation_id is not null
    )
      and cardinality(coalesce(sale.selected_modifier_ids, '{}'::text[])) = 0
    group by sale.sale_date, sale.item_name, sale.category
  )
  select * from provider_complete
  union all
  select * from provider_complete_with_modifiers
  union all
  select * from provider_incomplete
  union all
  select * from manual_sales
  order by sale_date desc, source_pos, provider_location_id nulls last, provider_catalog_item_id nulls last, provider_variation_id nulls last, item_name, id;
end;
$$;
