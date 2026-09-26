-- MISE-005U: pin prepare_square_sales_for_authority cntrl preflights to COLLATE "C".
--
-- private.prepare_square_sales_for_authority still rejects control characters with
-- bare POSIX [[:cntrl:]] on sale_source_record_id, item_name, incoming provider
-- location/variation/catalog ids, and derived_catalog_item_id. Bare [[:cntrl:]]
-- follows database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; MISE-005I pinned pos_sales provider-identity
-- CHECKs to collate "C", but left the authority prepare preflights on bare
-- [[:cntrl:]].
--
-- Prepare refuses with identity/item/provider/catalog invalid errors before any
-- durable write when those fields fail the length/cntrl gate. If LC_CTYPE drifted,
-- prepare could accept provider identity bytes a restored C-locale CHECK would
-- reject (or refuse ones the CHECK accepts) — breaking POS sale → recipe
-- depletion continuity after restore for the same Square identity bytes.
--
-- Scope:
--   - Rewrite private.prepare_square_sales_for_authority so every cntrl
--     preflight uses (<expr> collate "C") ~ '[[:cntrl:]]'
--   - Preserve revoke of EXECUTE from public/anon/authenticated/service_role
--     (security invoker helper; called only from private sync wrappers)
-- Does NOT reattach pos_sales provider-identity CHECKs (MISE-005I) or rewrite
-- service_begin / service_apply Square sync wrappers. Must apply after
-- MISE-003A authority correction. Prefer after MISE-005I so CHECK + prepare
-- pins land together; timestamp after 005T. Compose-safe alone on main.

create or replace function private.prepare_square_sales_for_authority(
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_from date,
  p_to date,
  p_require_complete boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sale jsonb;
  prepared_sales jsonb := '[]'::jsonb;
  sale_source_record_id text;
  item_name text;
  sale_date date;
  incoming_location_id text;
  incoming_variation_id text;
  incoming_catalog_item_id text;
  existing_location_id text;
  existing_variation_id text;
  existing_catalog_item_id text;
  resolved_location_id text;
  resolved_variation_id text;
  resolved_catalog_item_id text;
  derived_catalog_item_id text;
  catalog_match_count integer;
begin
  if p_sales is null or jsonb_typeof(p_sales) <> 'array'
    or p_catalog_items is null or jsonb_typeof(p_catalog_items) <> 'array'
  then
    raise exception 'Square sync payload is invalid' using errcode = '22023';
  end if;

  for sale in select value from jsonb_array_elements(p_sales)
  loop
    if jsonb_typeof(sale) <> 'object' then
      raise exception 'Square sale payload is invalid' using errcode = '22023';
    end if;

    sale_source_record_id := nullif(trim(coalesce(sale->>'source_record_id', '')), '');
    item_name := nullif(trim(coalesce(sale->>'item_name', '')), '');
    if sale_source_record_id is null
      or length(sale_source_record_id) > 200
      or sale_source_record_id collate "C" ~ '[[:cntrl:]]'
    then
      raise exception 'Square sale record identity is invalid' using errcode = '22023';
    end if;
    if p_require_complete and (
      item_name is null or length(item_name) > 160
      or item_name collate "C" ~ '[[:cntrl:]]'
    ) then
      raise exception 'Square sale item is invalid' using errcode = '22023';
    end if;

    begin
      sale_date := (sale->>'sale_date')::date;
    exception when others then
      raise exception 'Square sale date is invalid' using errcode = '22023';
    end;
    if p_require_complete and (sale_date < p_from or sale_date > p_to) then
      raise exception 'Square sale is outside the declared full snapshot' using errcode = '22023';
    end if;

    incoming_location_id := nullif(trim(coalesce(sale->>'provider_location_id', '')), '');
    incoming_variation_id := nullif(trim(coalesce(sale->>'provider_variation_id', '')), '');
    incoming_catalog_item_id := nullif(trim(coalesce(sale->>'provider_catalog_item_id', '')), '');
    if coalesce(length(incoming_location_id), 0) > 128
      or coalesce(length(incoming_variation_id), 0) > 128
      or coalesce(length(incoming_catalog_item_id), 0) > 128
      or coalesce(incoming_location_id, '') collate "C" ~ '[[:cntrl:]]'
      or coalesce(incoming_variation_id, '') collate "C" ~ '[[:cntrl:]]'
      or coalesce(incoming_catalog_item_id, '') collate "C" ~ '[[:cntrl:]]'
    then
      raise exception 'Square provider identity is invalid' using errcode = '22023';
    end if;

    existing_location_id := null;
    existing_variation_id := null;
    existing_catalog_item_id := null;
    if not p_require_complete then
      select existing.provider_location_id, existing.provider_variation_id,
        existing.provider_catalog_item_id
      into existing_location_id, existing_variation_id, existing_catalog_item_id
      from public.pos_sales existing
      where existing.restaurant_id = p_restaurant_id
        and existing.source_pos = 'Square'
        and existing.source_record_id = sale_source_record_id;
    end if;

    resolved_location_id := coalesce(incoming_location_id, existing_location_id);
    resolved_variation_id := coalesce(incoming_variation_id, existing_variation_id);

    select count(distinct nullif(trim(catalog.value->>'external_catalog_item_id'), '')),
      min(nullif(trim(catalog.value->>'external_catalog_item_id'), ''))
    into catalog_match_count, derived_catalog_item_id
    from jsonb_array_elements(p_catalog_items) catalog(value)
    where nullif(trim(catalog.value->>'external_variation_id'), '') = resolved_variation_id;

    if catalog_match_count > 1 then
      raise exception 'Square variation maps to multiple catalog items' using errcode = '22023';
    end if;
    if derived_catalog_item_id is not null and (
      length(derived_catalog_item_id) > 128
      or derived_catalog_item_id collate "C" ~ '[[:cntrl:]]'
    ) then
      raise exception 'Square catalog identity is invalid' using errcode = '22023';
    end if;
    if incoming_catalog_item_id is not null
      and derived_catalog_item_id is not null
      and incoming_catalog_item_id <> derived_catalog_item_id
    then
      raise exception 'Square sale catalog identity disagrees with the catalog snapshot'
        using errcode = '22023';
    end if;

    resolved_catalog_item_id := derived_catalog_item_id;
    if resolved_catalog_item_id is null
      and not p_require_complete
      and resolved_variation_id is not distinct from existing_variation_id
    then
      resolved_catalog_item_id := existing_catalog_item_id;
    end if;

    if p_require_complete and (
      resolved_location_id is null
      or resolved_variation_id is null
      or resolved_catalog_item_id is null
      or not exists (
        select 1
        from public.pos_locations location
        where location.restaurant_id = p_restaurant_id
          and location.pos_integration_id = p_integration_id
          and location.status = 'active'
          and location.external_location_id = resolved_location_id
      )
    ) then
      raise exception 'Full Square snapshot contains incomplete provider identity'
        using errcode = '22023';
    end if;

    prepared_sales := prepared_sales || jsonb_build_array(
      (sale - 'provider_location_id' - 'provider_catalog_item_id' - 'provider_variation_id')
      || case when resolved_location_id is null then '{}'::jsonb
        else jsonb_build_object('provider_location_id', resolved_location_id) end
      || case when resolved_catalog_item_id is null then '{}'::jsonb
        else jsonb_build_object('provider_catalog_item_id', resolved_catalog_item_id) end
      || case when resolved_variation_id is null then '{}'::jsonb
        else jsonb_build_object('provider_variation_id', resolved_variation_id) end
    );
  end loop;

  return prepared_sales;
end;
$$;

revoke all on function private.prepare_square_sales_for_authority(
  uuid, uuid, jsonb, jsonb, date, date, boolean
) from public, anon, authenticated, service_role;

comment on function private.prepare_square_sales_for_authority(
  uuid, uuid, jsonb, jsonb, date, date, boolean
) is
  'MISE-005U: prepare Square sales for authority sync; cntrl preflights use COLLATE C.';
