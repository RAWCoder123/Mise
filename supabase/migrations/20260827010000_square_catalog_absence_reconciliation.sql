-- Full Square catalog snapshots soft-close mappings and orphan menu items that
-- are no longer present in the provider catalog. History is never deleted.
-- Partial webhook refreshes must not mass-expire; only attested full snapshots
-- may reconcile absence.

create or replace function private.reconcile_square_catalog_absence(
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_catalog_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  closed_count integer := 0;
  deactivated_count integer := 0;
  closed_at timestamptz := clock_timestamp();
begin
  if p_restaurant_id is null or p_integration_id is null
    or p_catalog_items is null or jsonb_typeof(p_catalog_items) <> 'array'
  then
    raise exception 'Square catalog absence reconciliation payload is invalid'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.pos_integrations integration
    where integration.id = p_integration_id
      and integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square'
  ) then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;

  with present_catalog as (
    select distinct
      left(trim(coalesce(catalog.value->>'external_catalog_item_id', '')), 128) as external_catalog_item_id,
      left(trim(coalesce(catalog.value->>'external_variation_id', '')), 128) as external_variation_id
    from jsonb_array_elements(p_catalog_items) catalog(value)
    where left(trim(coalesce(catalog.value->>'external_catalog_item_id', '')), 128) <> ''
  ),
  closed_mappings as (
    update public.pos_catalog_item_mappings mapping
    set effective_to = closed_at,
      verification_status = 'expired',
      updated_at = closed_at
    from public.pos_locations location
    where mapping.restaurant_id = p_restaurant_id
      and mapping.effective_to is null
      and location.id = mapping.pos_location_id
      and location.restaurant_id = p_restaurant_id
      and location.pos_integration_id = p_integration_id
      and not exists (
        select 1
        from present_catalog present
        where present.external_catalog_item_id = mapping.external_catalog_item_id
          and present.external_variation_id = coalesce(mapping.external_variation_id, '')
      )
    returning mapping.menu_item_id
  ),
  closed_menu_items as (
    select distinct menu_item_id
    from closed_mappings
    where menu_item_id is not null
  ),
  deactivated as (
    update public.menu_items item
    set active = false,
      updated_at = closed_at
    from closed_menu_items closed
    where item.id = closed.menu_item_id
      and item.restaurant_id = p_restaurant_id
      and item.active = true
      and not exists (
        select 1
        from public.pos_catalog_item_mappings remaining
        where remaining.restaurant_id = p_restaurant_id
          and remaining.menu_item_id = item.id
          and remaining.effective_to is null
      )
    returning item.id
  )
  select
    (select count(*)::integer from closed_mappings),
    (select count(*)::integer from deactivated)
  into closed_count, deactivated_count;

  return jsonb_build_object(
    'catalogAbsenceReconciled', true,
    'catalogAbsentClosed', closed_count,
    'menuItemsDeactivated', deactivated_count
  );
end;
$$;

revoke all on function private.reconcile_square_catalog_absence(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

alter function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) rename to service_apply_square_sync_result_scoped_pre_catalog_absence;

revoke all on function private.service_apply_square_sync_result_scoped_pre_catalog_absence(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

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
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  applied jsonb;
  reconciliation jsonb := jsonb_build_object(
    'catalogAbsenceReconciled', false,
    'catalogAbsentClosed', 0,
    'menuItemsDeactivated', 0
  );
  import_id uuid;
begin
  applied := private.service_apply_square_sync_result_scoped_pre_catalog_absence(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    p_sync_token,
    p_snapshot_mode,
    p_sales,
    p_catalog_items,
    p_sync_cursor,
    p_from,
    p_to
  );

  if p_snapshot_mode = 'full' then
    reconciliation := private.reconcile_square_catalog_absence(
      p_restaurant_id,
      p_integration_id,
      p_catalog_items
    );
    import_id := nullif(applied->>'importId', '')::uuid;
    if import_id is not null then
      update public.sales_imports
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'catalog_absent_closed', reconciliation->'catalogAbsentClosed',
        'menu_items_deactivated', reconciliation->'menuItemsDeactivated',
        'catalog_absence_reconciled', true
      )
      where id = import_id
        and restaurant_id = p_restaurant_id;
      update public.audit_logs
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'catalog_absent_closed', reconciliation->'catalogAbsentClosed',
        'menu_items_deactivated', reconciliation->'menuItemsDeactivated',
        'catalog_absence_reconciled', true
      )
      where restaurant_id = p_restaurant_id
        and entity_id = import_id
        and action = 'square_sync_completed';
    end if;
  end if;

  return applied || reconciliation;
end;
$$;

revoke all on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

grant execute on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) to service_role;
