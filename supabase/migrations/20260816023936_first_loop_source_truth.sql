-- First-loop source truth: live Square planning is authorized only from one
-- selected location and a manager-verified catalog -> recipe -> ingredient
-- chain. Recommendation evidence is bounded, revision-bound, and rechecked at
-- approval, draft preparation, and provider-send authorization.

alter table public.pos_locations
  add column if not exists selected_for_planning boolean not null default false;

create unique index if not exists pos_locations_one_planning_location_per_integration
  on public.pos_locations (restaurant_id, pos_integration_id)
  where selected_for_planning and status = 'active';

with ranked_current_mappings as (
  select id, row_number() over (
    partition by restaurant_id, pos_location_id,
      external_catalog_item_id, external_variation_id
    order by (verification_status = 'verified') desc, updated_at desc, id
  ) as current_rank
  from public.pos_catalog_item_mappings
  where effective_to is null
)
update public.pos_catalog_item_mappings mapping
set effective_to = greatest(clock_timestamp(), mapping.effective_from + interval '1 microsecond'),
  verification_status = 'expired', updated_at = clock_timestamp()
from ranked_current_mappings ranked
where mapping.id = ranked.id and ranked.current_rank > 1;

create unique index if not exists pos_catalog_item_mappings_current_provider_identity_key
  on public.pos_catalog_item_mappings (
    restaurant_id, pos_location_id,
    external_catalog_item_id, external_variation_id
  ) where effective_to is null;

alter table public.pos_sales
  add column if not exists occurred_at timestamptz,
  add column if not exists pos_location_id uuid,
  add column if not exists external_catalog_item_id text,
  add column if not exists external_variation_id text;

do $$
begin
  alter table public.pos_sales
    add constraint pos_sales_location_fkey
    foreign key (restaurant_id, pos_location_id)
    references public.pos_locations (restaurant_id, id) on delete restrict;
exception when duplicate_object then null;
end
$$;

alter table public.pos_sales
  drop constraint if exists pos_sales_live_identity_bounds_check;
alter table public.pos_sales
  add constraint pos_sales_live_identity_bounds_check check (
    (external_catalog_item_id is null or length(external_catalog_item_id) between 1 and 128)
    and (external_variation_id is null or length(external_variation_id) between 1 and 128)
  );

create index if not exists pos_sales_live_planning_idx
  on public.pos_sales (
    restaurant_id, pos_location_id, occurred_at desc,
    external_catalog_item_id, external_variation_id
  ) where source_pos = 'Square';

create or replace function private.bump_restaurant_signal_state(p_restaurant_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.restaurant_signal_state (
    restaurant_id, planning_revision, signals_revision, status, updated_at
  ) values (p_restaurant_id, 1, 0, 'pending', now())
  on conflict (restaurant_id) do update
  set planning_revision = private.restaurant_signal_state.planning_revision + 1,
      status = 'pending',
      updated_at = now();
$$;

revoke all on function private.bump_restaurant_signal_state(uuid)
from public, anon, authenticated, service_role;

create or replace function private.reject_future_inventory_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.effective_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'Inventory event effective time cannot be in the future'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_future_inventory_event()
from public, anon, authenticated, service_role;

drop trigger if exists reject_future_inventory_event on public.inventory_events;
create trigger reject_future_inventory_event
before insert on public.inventory_events
for each row execute function private.reject_future_inventory_event();

alter table public.purchase_recommendations
  add column if not exists confidence text not null default 'blocked',
  add column if not exists source_evidence jsonb not null default jsonb_build_object(
    'version', 1,
    'mode', 'legacy',
    'countEvent', null,
    'salesThrough', null,
    'posLocationId', null,
    'mappingIds', jsonb_build_array(),
    'recipeVersionIds', jsonb_build_array(),
    'planningRevision', null,
    'generatedAt', '1970-01-01T00:00:00.000Z',
    'correlationId', '00000000-0000-0000-0000-000000000000'
  );

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_confidence_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_confidence_check
  check (confidence in ('blocked', 'low', 'medium', 'high'));
alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_source_evidence_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_source_evidence_check check (
    jsonb_typeof(source_evidence) = 'object'
    and octet_length(source_evidence::text) <= 16384
    and source_evidence ->> 'mode' in ('demo', 'manual_csv', 'square_verified', 'legacy')
    and jsonb_typeof(source_evidence -> 'mappingIds') = 'array'
    and jsonb_array_length(source_evidence -> 'mappingIds') <= 100
    and jsonb_typeof(source_evidence -> 'recipeVersionIds') = 'array'
    and jsonb_array_length(source_evidence -> 'recipeVersionIds') <= 100
  );

update public.purchase_recommendations
set confidence = 'blocked',
    source_evidence = jsonb_build_object(
      'version', 1,
      'mode', 'legacy',
      'countEvent', null,
      'salesThrough', null,
      'posLocationId', null,
      'mappingIds', jsonb_build_array(),
      'recipeVersionIds', jsonb_build_array(),
      'planningRevision', planning_revision,
      'generatedAt', created_at,
      'correlationId', '00000000-0000-0000-0000-000000000000'
    );

create or replace function public.select_pos_location(
  p_restaurant_id uuid,
  p_location_id uuid
)
returns public.pos_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_location public.pos_locations%rowtype;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select location.* into selected_location
  from public.pos_locations location
  join public.pos_integrations integration
    on integration.id = location.pos_integration_id
    and integration.restaurant_id = location.restaurant_id
  where location.restaurant_id = p_restaurant_id
    and location.id = p_location_id
    and location.status = 'active'
    and integration.provider = 'square'
    and integration.status = 'connected'
  for update of location, integration;
  if not found then
    raise exception 'Active Square location not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = selected_location.pos_integration_id
  order by location.id
  for update;

  update public.pos_locations
  set selected_for_planning = (id = p_location_id), updated_at = now()
  where restaurant_id = p_restaurant_id
    and pos_integration_id = selected_location.pos_integration_id;

  update public.pos_integrations
  set external_location_id = selected_location.external_location_id, updated_at = now()
  where restaurant_id = p_restaurant_id and id = selected_location.pos_integration_id;

  perform private.bump_restaurant_signal_state(p_restaurant_id);

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'square_planning_location_selected',
    'pos_locations', p_location_id,
    jsonb_build_object('external_location_id', selected_location.external_location_id)
  );

  select * into selected_location
  from public.pos_locations
  where restaurant_id = p_restaurant_id and id = p_location_id;
  return selected_location;
end;
$$;

create or replace function public.review_pos_catalog_mapping(
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_decision text
)
returns public.pos_catalog_item_mappings
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapping_row public.pos_catalog_item_mappings%rowtype;
  recipe_version_id uuid;
  next_version integer;
  legacy_count integer;
  result_row public.pos_catalog_item_mappings%rowtype;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'Catalog mapping decision is invalid' using errcode = '22023';
  end if;

  select mapping.* into mapping_row
  from public.pos_catalog_item_mappings mapping
  join public.pos_locations location
    on location.restaurant_id = mapping.restaurant_id
    and location.id = mapping.pos_location_id
  where mapping.restaurant_id = p_restaurant_id
    and mapping.id = p_mapping_id
    and mapping.effective_to is null
    and length(mapping.external_catalog_item_id) between 1 and 128
    and length(mapping.external_variation_id) between 1 and 128
    and location.status = 'active'
    and location.selected_for_planning
  for update of mapping, location;
  if not found then
    raise exception 'Current mapping for the selected Square location was not found' using errcode = 'P0002';
  end if;

  if p_decision = 'rejected' then
    update public.pos_catalog_item_mappings
    set verification_status = 'rejected', confidence = 0,
      verified_at = null, verified_by = null, updated_at = now()
    where restaurant_id = p_restaurant_id and id = p_mapping_id
    returning * into result_row;
  else
    select version.id into recipe_version_id
    from public.recipe_versions version
    where version.restaurant_id = p_restaurant_id
      and version.menu_item_id = mapping_row.menu_item_id
      and version.pos_location_id = mapping_row.pos_location_id
      and version.status = 'verified'
      and version.effective_from <= now()
      and (version.effective_to is null or version.effective_to > now())
      and exists (
        select 1 from public.recipe_ingredients ingredient
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.recipe_version_id = version.id
          and ingredient.verification_status = 'verified'
      )
    order by version.version_number desc
    limit 1;

    if recipe_version_id is null then
      select count(*) into legacy_count
      from public.menu_item_ingredients legacy
      join public.inventory_items item
        on item.restaurant_id = legacy.restaurant_id
        and item.id = legacy.inventory_item_id
      where legacy.restaurant_id = p_restaurant_id
        and lower(trim(legacy.menu_item_name)) = lower(trim(mapping_row.external_name))
        and legacy.quantity_used_per_sale > 0
        and lower(trim(legacy.unit)) = lower(trim(item.unit))
        and item.canonical_unit_verification_status = 'verified'
        and item.canonical_unit is not null
        and item.canonical_quantity_per_unit > 0;
      if legacy_count < 1 or exists (
        select 1
        from public.menu_item_ingredients legacy
        join public.inventory_items item
          on item.restaurant_id = legacy.restaurant_id
          and item.id = legacy.inventory_item_id
        where legacy.restaurant_id = p_restaurant_id
          and lower(trim(legacy.menu_item_name)) = lower(trim(mapping_row.external_name))
          and (
            legacy.quantity_used_per_sale <= 0
            or lower(trim(legacy.unit)) <> lower(trim(item.unit))
            or item.canonical_unit_verification_status <> 'verified'
            or item.canonical_unit is null
            or item.canonical_quantity_per_unit is null
            or item.canonical_quantity_per_unit <= 0
          )
      ) then
        raise exception 'Verify every recipe ingredient and canonical unit before approving this mapping'
          using errcode = '22023';
      end if;

      update public.recipe_versions
      set status = 'retired', effective_to = coalesce(effective_to, now()), updated_at = now()
      where restaurant_id = p_restaurant_id
        and menu_item_id = mapping_row.menu_item_id
        and pos_location_id = mapping_row.pos_location_id
        and status <> 'retired';

      select coalesce(max(version_number), 0) + 1 into next_version
      from public.recipe_versions
      where restaurant_id = p_restaurant_id
        and menu_item_id = mapping_row.menu_item_id
        and pos_location_id = mapping_row.pos_location_id;

      insert into public.recipe_versions (
        restaurant_id, menu_item_id, pos_location_id, version_number, status,
        serving_quantity, prep_yield, cooking_yield, effective_from,
        verified_at, verified_by
      ) values (
        p_restaurant_id, mapping_row.menu_item_id, mapping_row.pos_location_id,
        next_version, 'verified', 1, 1, 1, now(), now(), auth.uid()
      ) returning id into recipe_version_id;

      insert into public.recipe_ingredients (
        restaurant_id, recipe_version_id, inventory_item_id,
        quantity, canonical_unit, verification_status
      )
      select
        p_restaurant_id, recipe_version_id, legacy.inventory_item_id,
        legacy.quantity_used_per_sale * item.canonical_quantity_per_unit,
        item.canonical_unit, 'verified'
      from public.menu_item_ingredients legacy
      join public.inventory_items item
        on item.restaurant_id = legacy.restaurant_id
        and item.id = legacy.inventory_item_id
      where legacy.restaurant_id = p_restaurant_id
        and lower(trim(legacy.menu_item_name)) = lower(trim(mapping_row.external_name));
    end if;

    update public.pos_catalog_item_mappings
    set verification_status = 'verified', confidence = 1,
      verified_at = now(), verified_by = auth.uid(), updated_at = now()
    where restaurant_id = p_restaurant_id and id = p_mapping_id
    returning * into result_row;
  end if;

  perform private.bump_restaurant_signal_state(p_restaurant_id);
  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'square_catalog_mapping_' || p_decision,
    'pos_catalog_item_mappings', p_mapping_id,
    jsonb_build_object('recipe_version_id', recipe_version_id)
  );
  return result_row;
end;
$$;

revoke all on function public.select_pos_location(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.review_pos_catalog_mapping(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.select_pos_location(uuid, uuid) to authenticated;
grant execute on function public.review_pos_catalog_mapping(uuid, uuid, text) to authenticated;

-- Hosted recommendations are generated only from the Edge-owned planning
-- snapshot and commit boundary. The legacy client creation RPC cannot attach
-- or revalidate source evidence, so it is intentionally retired.
revoke all on function public.create_pending_purchase_recommendation(
  uuid, uuid, numeric, text, text
) from public, anon, authenticated, service_role;

-- An approved physical count is evidence even when the observed quantity did
-- not change. The original approval RPC already writes changed lines; this
-- trigger fills only the stable-key gaps before signal generation commits.
create or replace function private.record_unchanged_count_session_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.inventory_events (
      restaurant_id, inventory_item_id, event_type, quantity, canonical_unit,
      effective_at, actor_user_id, source, source_reference,
      client_event_id, idempotency_key, metadata
    )
    select
      new.restaurant_id, line.inventory_item_id, 'count',
      line.counted_quantity * item.canonical_quantity_per_unit,
      item.canonical_unit, coalesce(new.approved_at, clock_timestamp()),
      new.approved_by, 'approve_count_session', new.id::text,
      'count_session:' || new.id::text || ':' || line.inventory_item_id::text,
      'count_session:' || new.id::text || ':' || line.inventory_item_id::text,
      jsonb_build_object(
        'session_id', new.id,
        'system_quantity_at_start', line.system_quantity_at_start,
        'variance_from_system', line.counted_quantity - line.system_quantity_at_start
      ) || case when nullif(trim(coalesce(line.note, '')), '') is null
        then '{}'::jsonb else jsonb_build_object('note', trim(line.note)) end
    from public.inventory_count_lines line
    join public.inventory_items item
      on item.restaurant_id = line.restaurant_id and item.id = line.inventory_item_id
    where line.restaurant_id = new.restaurant_id
      and line.session_id = new.id
      and line.counted_quantity is not null
      and item.canonical_unit_verification_status = 'verified'
      and item.canonical_unit is not null
      and item.canonical_quantity_per_unit > 0
    on conflict (restaurant_id, idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.record_unchanged_count_session_evidence()
from public, anon, authenticated, service_role;
drop trigger if exists inventory_count_sessions_record_unchanged_evidence
on public.inventory_count_sessions;
create trigger inventory_count_sessions_record_unchanged_evidence
after update of status on public.inventory_count_sessions
for each row execute function private.record_unchanged_count_session_evidence();

create or replace function private.service_fetch_square_sync_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  credential private.square_credentials%rowtype;
  decrypted_credential text;
  location_ids text[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;

  select * into system_controls
  from public.system_operational_controls where singleton;
  if not found
    or system_controls.operational_mode <> 'normal'
    or not system_controls.square_sync_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  insert into public.restaurant_operational_controls (restaurant_id)
  values (p_restaurant_id) on conflict (restaurant_id) do nothing;
  select * into restaurant_controls
  from public.restaurant_operational_controls
  where restaurant_id = p_restaurant_id;
  if not found or not restaurant_controls.square_sync_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into credential
  from private.square_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then return jsonb_build_object('outcome', 'not_connected'); end if;

  select coalesce(array_agg(location.external_location_id order by location.id), '{}')
  into location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = credential.pos_integration_id
    and location.status = 'active'
    and location.selected_for_planning;
  if cardinality(location_ids) <> 1 then
    return jsonb_build_object('outcome', 'location_selection_required');
  end if;

  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    raise exception 'Square credential is unavailable' using errcode = '55000';
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'integrationId', credential.pos_integration_id,
    'merchantId', credential.merchant_id,
    'refreshToken', decrypted_credential,
    'locationIds', to_jsonb(location_ids)
  );
end;
$$;

create or replace function private.service_apply_square_sync_result(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
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
  sale jsonb;
  catalog_item jsonb;
  import_id uuid := gen_random_uuid();
  processed_count integer := 0;
  catalog_processed integer := 0;
  resolved_menu_item_id uuid;
  selected_location_id uuid;
  selected_external_location_id text;
  catalog_external_name text;
  catalog_item_external_id text;
  catalog_variation_id text;
  updated_mapping_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array'
    or jsonb_array_length(p_sales) > 10000
    or p_catalog_items is null or jsonb_typeof(p_catalog_items) <> 'array'
    or jsonb_array_length(p_catalog_items) > 10000
    or p_from is null or p_to is null or p_to < p_from
  then
    raise exception 'Square sync payload is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pos_integrations integration
    where integration.id = p_integration_id
      and integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square'
  ) then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;

  select location.id, location.external_location_id
  into selected_location_id, selected_external_location_id
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active'
    and location.selected_for_planning;
  if not found or (
    select count(*) from public.pos_locations location
    where location.restaurant_id = p_restaurant_id
      and location.pos_integration_id = p_integration_id
      and location.status = 'active'
      and location.selected_for_planning
  ) <> 1 then
    raise exception 'Select exactly one active Square location before syncing'
      using errcode = '22023';
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'processing', 0,
    jsonb_build_object(
      'provider', 'square', 'from', p_from, 'to', p_to,
      'pos_location_id', selected_location_id,
      'external_location_id', selected_external_location_id
    ), now()
  );

  for sale in select value from jsonb_array_elements(p_sales)
  loop
    if jsonb_typeof(sale) <> 'object'
      or length(trim(coalesce(sale->>'source_record_id', ''))) not between 1 and 200
      or length(trim(coalesce(sale->>'item_name', ''))) not between 1 and 160
      or coalesce(sale->>'sale_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      or coalesce(sale->>'occurred_at', '') = ''
      or coalesce(sale->>'external_location_id', '') <> selected_external_location_id
      or length(coalesce(sale->>'external_catalog_item_id', '')) not between 1 and 128
      or length(coalesce(sale->>'external_variation_id', '')) not between 1 and 128
      or coalesce((sale->>'quantity_sold')::numeric, 0) <= 0
    then
      raise exception 'Square sale is missing verified provider identity' using errcode = '22023';
    end if;
    if (sale->>'sale_date')::date < p_from or (sale->>'sale_date')::date > p_to
      or (sale->>'occurred_at')::timestamptz > now() + interval '5 minutes'
    then
      raise exception 'Square sale timestamp is outside the authorized sync window' using errcode = '22023';
    end if;

    insert into public.pos_sales (
      restaurant_id, sale_date, occurred_at, pos_location_id,
      external_catalog_item_id, external_variation_id,
      item_name, category, quantity_sold, gross_sales, net_sales,
      source_pos, source_record_id
    ) values (
      p_restaurant_id,
      (sale->>'sale_date')::date,
      (sale->>'occurred_at')::timestamptz,
      selected_location_id,
      sale->>'external_catalog_item_id',
      sale->>'external_variation_id',
      trim(sale->>'item_name'),
      left(coalesce(sale->>'category', 'Square'), 80),
      least(100000::numeric, (sale->>'quantity_sold')::numeric),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'gross_sales')::numeric, 0))),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'net_sales')::numeric, 0))),
      'Square', trim(sale->>'source_record_id')
    )
    on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set
      sale_date = excluded.sale_date,
      occurred_at = excluded.occurred_at,
      pos_location_id = excluded.pos_location_id,
      external_catalog_item_id = excluded.external_catalog_item_id,
      external_variation_id = excluded.external_variation_id,
      item_name = excluded.item_name,
      category = excluded.category,
      quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales,
      net_sales = excluded.net_sales;
    processed_count := processed_count + 1;
  end loop;

  for catalog_item in select value from jsonb_array_elements(p_catalog_items)
  loop
    resolved_menu_item_id := null;
    updated_mapping_id := null;
    catalog_external_name := left(trim(coalesce(catalog_item->>'external_name', '')), 160);
    catalog_item_external_id := left(coalesce(catalog_item->>'external_catalog_item_id', ''), 128);
    catalog_variation_id := left(coalesce(catalog_item->>'external_variation_id', ''), 128);
    if catalog_external_name = '' or catalog_item_external_id = '' or catalog_variation_id = '' then
      continue;
    end if;

    select item.id into resolved_menu_item_id
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
      and lower(trim(item.name)) = lower(trim(catalog_external_name))
    limit 1;
    if resolved_menu_item_id is null then
      insert into public.menu_items (restaurant_id, name, category, active)
      values (
        p_restaurant_id, catalog_external_name,
        left(coalesce(catalog_item->>'category', 'Square'), 80), true
      ) returning id into resolved_menu_item_id;
    else
      update public.menu_items
      set category = left(coalesce(catalog_item->>'category', 'Square'), 80),
        active = true, updated_at = now()
      where id = resolved_menu_item_id and restaurant_id = p_restaurant_id;
    end if;

    update public.pos_catalog_item_mappings mapping
    set external_name = catalog_external_name,
      menu_item_id = case
        when mapping.verification_status = 'verified' then mapping.menu_item_id
        else resolved_menu_item_id
      end,
      updated_at = now()
    where mapping.restaurant_id = p_restaurant_id
      and mapping.pos_location_id = selected_location_id
      and mapping.external_catalog_item_id = catalog_item_external_id
      and mapping.external_variation_id = catalog_variation_id
      and mapping.effective_to is null
    returning mapping.id into updated_mapping_id;
    if updated_mapping_id is null then
      insert into public.pos_catalog_item_mappings (
        restaurant_id, pos_location_id, external_catalog_item_id,
        external_variation_id, external_name, menu_item_id,
        verification_status, confidence
      ) values (
        p_restaurant_id, selected_location_id, catalog_item_external_id,
        catalog_variation_id, catalog_external_name, resolved_menu_item_id,
        'draft', 0
      );
    end if;
    catalog_processed := catalog_processed + 1;
  end loop;

  update public.sales_imports
  set status = 'completed', records_processed = processed_count,
    metadata = metadata || jsonb_build_object('catalog_processed', catalog_processed),
    imported_at = now()
  where id = import_id;
  update public.pos_integrations
  set status = 'connected', last_sync_at = now(),
    sync_cursor = nullif(left(coalesce(p_sync_cursor, ''), 500), ''),
    external_location_id = selected_external_location_id, updated_at = now()
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_sync_completed',
    'sales_imports', import_id,
    jsonb_build_object(
      'provider', 'square', 'records_processed', processed_count,
      'catalog_processed', catalog_processed,
      'pos_location_id', selected_location_id
    )
  );
  return jsonb_build_object(
    'importId', import_id, 'recordsProcessed', processed_count,
    'catalogProcessed', catalog_processed, 'status', 'completed'
  );
end;
$$;

create or replace function public.service_fetch_square_sync_credential(
  p_actor_user_id uuid, p_restaurant_id uuid
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.service_fetch_square_sync_credential(p_actor_user_id, p_restaurant_id); $$;

create or replace function public.service_apply_square_sync_result(
  p_actor_user_id uuid, p_restaurant_id uuid, p_integration_id uuid,
  p_sales jsonb, p_catalog_items jsonb, p_sync_cursor text,
  p_from date, p_to date
)
returns jsonb language sql security invoker set search_path = ''
as $$
  select private.service_apply_square_sync_result(
    p_actor_user_id, p_restaurant_id, p_integration_id,
    p_sales, p_catalog_items, p_sync_cursor, p_from, p_to
  );
$$;

revoke all on function private.service_fetch_square_sync_credential(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.service_fetch_square_sync_credential(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
grant execute on function private.service_fetch_square_sync_credential(uuid, uuid) to service_role;
grant execute on function public.service_fetch_square_sync_credential(uuid, uuid) to service_role;
grant execute on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;
grant execute on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;

create or replace function private.recommendation_source_is_current(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_source_evidence jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  count_row public.inventory_events%rowtype;
  selected_location_id uuid;
  evidence_count_id uuid;
  evidence_id uuid;
  evidence_id_text text;
  evidence_generated_at timestamptz;
  evidence_sales_through timestamptz;
  square_live boolean;
begin
  if p_expected_revision is null
    or p_source_evidence is null
    or jsonb_typeof(p_source_evidence) <> 'object'
    or octet_length(p_source_evidence::text) > 16384
    or p_source_evidence->>'mode' not in ('manual_csv', 'square_verified')
    or jsonb_typeof(p_source_evidence->'countEvent') <> 'object'
    or jsonb_typeof(p_source_evidence->'mappingIds') <> 'array'
    or jsonb_typeof(p_source_evidence->'recipeVersionIds') <> 'array'
    or jsonb_array_length(p_source_evidence->'mappingIds') > 100
    or jsonb_array_length(p_source_evidence->'recipeVersionIds') > 100
    or p_source_evidence->>'planningRevision' is null
    or p_source_evidence->>'generatedAt' is null
    or p_source_evidence->'countEvent'->>'countEventId' is null
    or p_source_evidence->'countEvent'->>'effectiveAt' is null
    or p_source_evidence->'countEvent'->>'recordedAt' is null
    or p_source_evidence->'countEvent'->>'sequence' is null
    or p_source_evidence->'countEvent'->>'quantity' is null
    or p_source_evidence->'countEvent'->>'canonicalUnit' is null
    or coalesce(p_source_evidence->>'correlationId', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_source_evidence->>'correlationId' = '00000000-0000-0000-0000-000000000000'
  then
    return false;
  end if;

  begin
    if (p_source_evidence->>'planningRevision')::bigint is distinct from p_expected_revision then return false; end if;
    evidence_generated_at := (p_source_evidence->>'generatedAt')::timestamptz;
    if evidence_generated_at > now() + interval '5 minutes' then return false; end if;
    evidence_count_id := (p_source_evidence->'countEvent'->>'countEventId')::uuid;
    if (p_source_evidence->'countEvent'->>'inventoryItemId')::uuid <> p_inventory_item_id then
      return false;
    end if;
    if p_source_evidence->>'salesThrough' is not null then
      evidence_sales_through := (p_source_evidence->>'salesThrough')::timestamptz;
      if evidence_sales_through > evidence_generated_at then return false; end if;
    end if;
  exception when others then
    return false;
  end;

  if not exists (
    select 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id
      and state.planning_revision = p_expected_revision
  ) then return false; end if;

  select event.* into count_row
  from public.inventory_events event
  where event.restaurant_id = p_restaurant_id
    and event.inventory_item_id = p_inventory_item_id
    and event.event_type = 'count'
    and not exists (
      select 1 from public.inventory_events correction
      where correction.restaurant_id = p_restaurant_id
        and correction.supersedes_event_id = event.id
    )
  order by event.effective_at desc, event.sequence desc
  limit 1;
  if not found
    or count_row.id <> evidence_count_id
    or count_row.effective_at < now() - interval '36 hours'
    or count_row.effective_at > now() + interval '5 minutes'
    or count_row.effective_at is distinct from
      (p_source_evidence->'countEvent'->>'effectiveAt')::timestamptz
    or count_row.recorded_at is distinct from
      (p_source_evidence->'countEvent'->>'recordedAt')::timestamptz
    or count_row.sequence is distinct from
      (p_source_evidence->'countEvent'->>'sequence')::bigint
    or count_row.quantity is distinct from
      (p_source_evidence->'countEvent'->>'quantity')::numeric
    or count_row.canonical_unit is distinct from
      p_source_evidence->'countEvent'->>'canonicalUnit'
    or not exists (
      select 1
      from public.inventory_items item
      where item.restaurant_id = p_restaurant_id
        and item.id = p_inventory_item_id
        and item.canonical_unit_verification_status = 'verified'
        and item.canonical_unit = count_row.canonical_unit
        and item.canonical_quantity_per_unit > 0
    )
  then return false; end if;

  select exists (
    select 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square'
      and integration.status = 'connected'
  ) into square_live;
  if square_live <> (p_source_evidence->>'mode' = 'square_verified') then return false; end if;

  if not square_live then return true; end if;

  begin
    selected_location_id := (p_source_evidence->>'posLocationId')::uuid;
  exception when others then return false;
  end;
  if (
    select count(*) from public.pos_locations location
    join public.pos_integrations integration
      on integration.restaurant_id = location.restaurant_id
      and integration.id = location.pos_integration_id
    where location.restaurant_id = p_restaurant_id
      and location.id = selected_location_id
      and location.status = 'active'
      and location.selected_for_planning
      and integration.provider = 'square'
      and integration.status = 'connected'
  ) <> 1 then return false; end if;

  if jsonb_array_length(p_source_evidence->'mappingIds') < 1
    or jsonb_array_length(p_source_evidence->'recipeVersionIds') < 1
  then return false; end if;

  for evidence_id_text in
    select value from jsonb_array_elements_text(p_source_evidence->'mappingIds')
  loop
    if evidence_id_text !~* '^[0-9a-f-]{36}$' then return false; end if;
    begin evidence_id := evidence_id_text::uuid;
    exception when others then return false;
    end;
    if not exists (
      select 1
      from public.pos_catalog_item_mappings mapping
      join public.recipe_versions version
        on version.restaurant_id = mapping.restaurant_id
        and version.menu_item_id = mapping.menu_item_id
        and version.pos_location_id = mapping.pos_location_id
      join public.recipe_ingredients ingredient
        on ingredient.restaurant_id = version.restaurant_id
        and ingredient.recipe_version_id = version.id
      join public.inventory_items item
        on item.restaurant_id = ingredient.restaurant_id
        and item.id = ingredient.inventory_item_id
      where mapping.restaurant_id = p_restaurant_id
        and mapping.id = evidence_id
        and mapping.pos_location_id = selected_location_id
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= now()
        and (mapping.effective_to is null or mapping.effective_to > now())
        and version.status = 'verified'
        and version.effective_from <= now()
        and (version.effective_to is null or version.effective_to > now())
        and (p_source_evidence->'recipeVersionIds') ? version.id::text
        and ingredient.inventory_item_id = p_inventory_item_id
        and ingredient.verification_status = 'verified'
        and item.canonical_unit_verification_status = 'verified'
        and item.canonical_unit = ingredient.canonical_unit
        and item.canonical_quantity_per_unit > 0
    ) then return false; end if;
  end loop;

  for evidence_id_text in
    select value from jsonb_array_elements_text(p_source_evidence->'recipeVersionIds')
  loop
    if evidence_id_text !~* '^[0-9a-f-]{36}$' then return false; end if;
    begin evidence_id := evidence_id_text::uuid;
    exception when others then return false;
    end;
    if not exists (
      select 1
      from public.recipe_versions version
      join public.pos_catalog_item_mappings mapping
        on mapping.restaurant_id = version.restaurant_id
        and mapping.menu_item_id = version.menu_item_id
        and mapping.pos_location_id = version.pos_location_id
      join public.recipe_ingredients ingredient
        on ingredient.restaurant_id = version.restaurant_id
        and ingredient.recipe_version_id = version.id
      where version.restaurant_id = p_restaurant_id
        and version.id = evidence_id
        and version.pos_location_id = selected_location_id
        and version.status = 'verified'
        and version.effective_from <= now()
        and (version.effective_to is null or version.effective_to > now())
        and (p_source_evidence->'mappingIds') ? mapping.id::text
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= now()
        and (mapping.effective_to is null or mapping.effective_to > now())
        and ingredient.inventory_item_id = p_inventory_item_id
        and ingredient.verification_status = 'verified'
    ) then return false; end if;
  end loop;

  if evidence_sales_through is not null and not exists (
    select 1 from public.pos_sales sale
    where sale.restaurant_id = p_restaurant_id
      and sale.pos_location_id = selected_location_id
      and sale.occurred_at = evidence_sales_through
  ) then return false; end if;
  return true;
exception when others then
  return false;
end;
$$;

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
  generated_at timestamptz := clock_timestamp();
  selected_location_id uuid;
  planning_mode text := 'manual_csv';
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending') on conflict (restaurant_id) do nothing;
  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;

  begin
    select timezone(restaurant.timezone, generated_at)::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then operating_date := current_date;
  end;

  if exists (
    select 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square' and integration.status = 'connected'
  ) then
    planning_mode := 'square_live';
    select location.id into selected_location_id
    from public.pos_locations location
    join public.pos_integrations integration
      on integration.restaurant_id = location.restaurant_id
      and integration.id = location.pos_integration_id
    where location.restaurant_id = p_restaurant_id
      and location.status = 'active' and location.selected_for_planning
      and integration.provider = 'square' and integration.status = 'connected'
    limit 1;
  end if;

  return jsonb_build_object(
    'revision', current_revision,
    'planningRevision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
    'planningMode', planning_mode,
    'selectedPosLocationId', selected_location_id,
    'generatedAt', generated_at,
    'correlationId', gen_random_uuid(),
    'inventoryItems', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.item_name, item.id)
      from public.inventory_items item where item.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.sale_date desc, sale.item_name, sale.id)
      from (
        select * from public.pos_sales
        where restaurant_id = p_restaurant_id
        order by sale_date desc, id limit 2000
      ) sale
    ), '[]'::jsonb),
    'menuItemIngredients', coalesce((
      select jsonb_agg(to_jsonb(mapping) order by mapping.menu_item_name, mapping.id)
      from public.menu_item_ingredients mapping where mapping.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'inventoryEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'sequence', event.sequence,
        'restaurantId', event.restaurant_id, 'inventoryItemId', event.inventory_item_id,
        'eventType', event.event_type, 'quantity', event.quantity,
        'canonicalUnit', event.canonical_unit, 'effectiveAt', event.effective_at,
        'recordedAt', event.recorded_at, 'actorUserId', event.actor_user_id,
        'source', event.source, 'sourceReference', event.source_reference,
        'reasonCode', event.reason_code, 'clientEventId', event.client_event_id,
        'idempotencyKey', event.idempotency_key,
        'supersedesEventId', event.supersedes_event_id, 'metadata', event.metadata
      ) order by event.sequence)
      from (
        select * from public.inventory_events
        where restaurant_id = p_restaurant_id
        order by sequence desc limit 5000
      ) event
    ), '[]'::jsonb),
    'verifiedRecipeMappings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurant_id', mapping.restaurant_id,
        'pos_location_id', mapping.pos_location_id,
        'catalog_mapping_id', mapping.id,
        'recipe_version_id', version.id,
        'external_catalog_item_id', mapping.external_catalog_item_id,
        'external_variation_id', mapping.external_variation_id,
        'inventory_item_id', ingredient.inventory_item_id,
        'quantity_used_per_sale',
          ingredient.quantity / version.serving_quantity / item.canonical_quantity_per_unit,
        'unit', item.unit
      ) order by mapping.id, version.id, ingredient.id)
      from public.pos_catalog_item_mappings mapping
      join public.recipe_versions version
        on version.restaurant_id = mapping.restaurant_id
        and version.menu_item_id = mapping.menu_item_id
        and version.pos_location_id = mapping.pos_location_id
      join public.recipe_ingredients ingredient
        on ingredient.restaurant_id = version.restaurant_id
        and ingredient.recipe_version_id = version.id
      join public.inventory_items item
        on item.restaurant_id = ingredient.restaurant_id
        and item.id = ingredient.inventory_item_id
      where mapping.restaurant_id = p_restaurant_id
        and mapping.pos_location_id = selected_location_id
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= generated_at
        and (mapping.effective_to is null or mapping.effective_to > generated_at)
        and version.status = 'verified'
        and version.effective_from <= generated_at
        and (version.effective_to is null or version.effective_to > generated_at)
        and ingredient.verification_status = 'verified'
        and item.canonical_unit_verification_status = 'verified'
        and item.canonical_unit = ingredient.canonical_unit
        and item.canonical_quantity_per_unit > 0
    ), '[]'::jsonb),
    'recommendationHistory', coalesce((
      select jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at desc, recommendation.id)
      from (
        select * from public.purchase_recommendations
        where restaurant_id = p_restaurant_id and status <> 'pending'
        order by created_at desc, id limit 500
      ) recommendation
    ), '[]'::jsonb)
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
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;
  if jsonb_typeof(safe_recommendations) <> 'array'
    or jsonb_typeof(safe_insights) <> 'array'
    or jsonb_array_length(safe_recommendations) > 250
    or jsonb_array_length(safe_insights) > 50
  then raise exception 'Operational signal payload is outside supported limits' using errcode = '22023'; end if;
  if jsonb_typeof(safe_setup_metadata) <> 'object'
    or octet_length(safe_setup_metadata::text) > 8192
  then raise exception 'Setup metadata must be a bounded object' using errcode = '22023'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id for update;
  if not found or current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(safe_recommendations) payload(
      inventory_item_id uuid, recommended_quantity numeric, reason text,
      urgency text, confidence text, source_evidence jsonb
    )
    left join public.inventory_items item
      on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
    where item.id is null
      or payload.recommended_quantity is null
      or payload.recommended_quantity <= 0 or payload.recommended_quantity > 1000000
      or payload.urgency not in ('low', 'medium', 'high')
      or payload.confidence not in ('low', 'medium', 'high')
      or length(trim(payload.reason)) not between 1 and 2000
      or not private.recommendation_source_is_current(
        p_restaurant_id, payload.inventory_item_id, current_revision, payload.source_evidence
      )
  ) then raise exception 'Generated recommendation evidence is invalid or stale' using errcode = '22023'; end if;

  if exists (
    select 1 from jsonb_to_recordset(safe_insights) payload(
      insight_type text, title text, description text, why_it_matters text,
      recommended_action text, severity text
    )
    where payload.insight_type not in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
      or payload.severity not in ('info', 'warning', 'urgent')
      or length(trim(payload.title)) not between 1 and 240
      or length(trim(payload.description)) not between 1 and 4000
      or length(trim(payload.recommended_action)) not between 1 and 2000
      or (payload.why_it_matters is not null and length(payload.why_it_matters) > 2000)
  ) then raise exception 'Generated insight payload is invalid' using errcode = '22023'; end if;

  delete from public.purchase_recommendations
  where restaurant_id = p_restaurant_id and status = 'pending'
    and (generation_source in ('mise_rules', 'legacy_client') or confidence = 'blocked');

  insert into public.purchase_recommendations (
    restaurant_id, inventory_item_id, item_name, supplier_name,
    recommended_quantity, unit, reason, urgency, status, supplier_order_id,
    generation_source, planning_revision, confidence, source_evidence
  )
  select
    p_restaurant_id, item.id, item.item_name, item.supplier_name,
    payload.recommended_quantity, item.unit, trim(payload.reason), payload.urgency,
    'pending', null, 'mise_rules', current_revision,
    payload.confidence, payload.source_evidence
  from jsonb_to_recordset(safe_recommendations) payload(
    inventory_item_id uuid, recommended_quantity numeric, reason text,
    urgency text, confidence text, source_evidence jsonb
  )
  join public.inventory_items item
    on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
  where not exists (
    select 1 from public.purchase_recommendations manual
    where manual.restaurant_id = p_restaurant_id
      and manual.inventory_item_id = item.id and manual.status = 'pending'
      and manual.generation_source = 'manual' and manual.confidence <> 'blocked'
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
    where audit.restaurant_id = p_restaurant_id and audit.action = 'setup_completed'
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
    'planning_revision', current_revision, 'signals_status', 'current',
    'recommendations', inserted_recommendations, 'insights', inserted_insights
  );
end;
$$;

revoke all on function private.recommendation_source_is_current(uuid, uuid, bigint, jsonb)
from public, anon, authenticated, service_role;
revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function private.commit_operational_signals(
  uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb
) from public, anon, authenticated, service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
grant execute on function private.commit_operational_signals(
  uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb
) to service_role;

-- Approval is a human decision on already-generated evidence, not a new
-- planning input. Keep the recommendation's revision current until another
-- source change occurs so the reviewed draft can be authorized and sent.
create or replace function private.bump_recommendation_history_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid := case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
  should_bump boolean := false;
begin
  if pg_catalog.current_setting(
    'mise.inventory_event_tenant_delete',
    true
  ) = 'true'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    should_bump := new.status in ('approved', 'dismissed', 'ordered');
  elsif tg_op = 'DELETE' then
    should_bump := old.status in ('approved', 'dismissed', 'ordered');
  elsif old.status = 'pending' and new.status = 'approved' then
    should_bump := false;
  else
    should_bump := old.status is distinct from new.status
      or (new.status in ('approved', 'ordered') and old.recommended_quantity is distinct from new.recommended_quantity);
  end if;
  if should_bump then
    insert into private.restaurant_signal_state (
      restaurant_id, planning_revision, signals_revision, status, updated_at
    ) values (target_restaurant_id, 1, 0, 'pending', now())
    on conflict (restaurant_id) do update
    set planning_revision = private.restaurant_signal_state.planning_revision + 1,
        status = 'pending',
        updated_at = now();
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.bump_recommendation_history_revision()
from public, anon, authenticated, service_role;

create or replace function private.order_recommendation_sources_are_current(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
  ) and not exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
      and (
        recommendation.confidence = 'blocked'
        or not private.signals_are_current(
          recommendation.restaurant_id, recommendation.planning_revision
        )
        or not private.recommendation_source_is_current(
          recommendation.restaurant_id,
          recommendation.inventory_item_id,
          recommendation.planning_revision,
          recommendation.source_evidence
        )
      )
  );
$$;

revoke all on function private.order_recommendation_sources_are_current(uuid, uuid)
from public, anon, authenticated, service_role;

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
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  previous_status text;
  workflow_outcome text := 'applied';
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;
  if p_recommended_quantity is not null and (
    p_recommended_quantity <= 0 or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then raise exception 'Enter a valid order quantity' using errcode = '22023'; end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id and id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;
  if recommendation_row.confidence = 'blocked'
    or not private.signals_are_current(
      recommendation_row.restaurant_id, recommendation_row.planning_revision
    )
    or not private.recommendation_source_is_current(
      recommendation_row.restaurant_id,
      recommendation_row.inventory_item_id,
      recommendation_row.planning_revision,
      recommendation_row.source_evidence
    )
  then
    raise exception 'Recommendation evidence is stale or incomplete; regenerate before approval'
      using errcode = '22023';
  end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('dismissed', 'ordered') then raise exception 'Already handled'; end if;
  if recommendation_row.status = 'approved' then workflow_outcome := 'already_applied'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || recommendation_row.supplier_name, 0)
  );
  if recommendation_row.supplier_order_id is not null then
    select * into order_row from public.supplier_orders
    where restaurant_id = p_restaurant_id and id = recommendation_row.supplier_order_id
    for update;
    if found and order_row.status <> 'draft' then raise exception 'Already handled'; end if;
  end if;
  if order_row.id is null then
    select * into order_row from public.supplier_orders
    where restaurant_id = p_restaurant_id
      and supplier_name = recommendation_row.supplier_name and status = 'draft'
    order by created_at desc, id desc limit 1 for update;
  end if;
  if order_row.id is null then
    insert into public.supplier_orders (
      restaurant_id, supplier_name, order_message, operator_note, status, delivery_date
    ) values (
      p_restaurant_id, recommendation_row.supplier_name,
      'Order draft for ' || recommendation_row.supplier_name || E'\n\nDelivery requested: Tomorrow morning',
      null, 'draft', current_date + 1
    ) returning * into order_row;
  end if;

  update public.purchase_recommendations
  set status = 'approved',
    recommended_quantity = case
      when previous_status = 'pending' and p_recommended_quantity is not null
        then p_recommended_quantity else recommended_quantity end,
    supplier_order_id = order_row.id
  where restaurant_id = p_restaurant_id and id = p_recommendation_id
  returning * into recommendation_row;

  update public.supplier_orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
  )
  where restaurant_id = p_restaurant_id and id = order_row.id
  returning * into order_row;

  if workflow_outcome = 'applied' then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'recommendation_approved',
      'purchase_recommendations', recommendation_row.id,
      jsonb_build_object(
        'supplier_name', recommendation_row.supplier_name,
        'urgency', recommendation_row.urgency,
        'supplier_order_id', order_row.id,
        'confidence', recommendation_row.confidence,
        'correlation_id', recommendation_row.source_evidence->>'correlationId'
      )
    );
  end if;
  return jsonb_build_object(
    'outcome', workflow_outcome, 'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row), 'order', to_jsonb(order_row)
  );
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
to authenticated;

create or replace function public.approve_supplier_send_envelope(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_order_id uuid,
  p_reviewed_from text,
  p_reviewed_to text,
  p_reviewed_subject text
)
returns public.mise_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions%rowtype;
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  current_from text;
  current_to text;
  current_subject text;
  current_body_hash text;
  reviewed_from text := lower(trim(p_reviewed_from));
  reviewed_to text := lower(trim(p_reviewed_to));
  reviewed_subject text := trim(p_reviewed_subject);
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then raise exception 'Manager access required' using errcode = '42501'; end if;
  if reviewed_from is null or reviewed_to is null or reviewed_subject is null
    or length(reviewed_from) not between 3 and 254
    or length(reviewed_to) not between 3 and 254
    or length(reviewed_subject) not between 1 and 998
    or reviewed_from ~ '[[:cntrl:]]' or reviewed_to ~ '[[:cntrl:]]'
    or reviewed_subject ~ '[[:cntrl:]]'
    or reviewed_from !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or reviewed_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then raise exception 'Supplier send approval requires a valid reviewed envelope' using errcode = '22023'; end if;

  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id and action.id = p_action_id
    and action.action_type = 'send_supplier_order'
    and (
      action.idempotency_key = format('send_supplier_order:%s', p_order_id)
      or action.expected_impact->>'orderId' = p_order_id::text
    ) for update;
  if not found then
    raise exception 'Supplier send approval required: prepared action not found' using errcode = '22023';
  end if;
  if action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed') then
    raise exception 'Supplier send approval required: action is not approvable' using errcode = '22023';
  end if;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id for update;
  if not found or order_row.status <> 'draft' then
    raise exception 'Supplier send approval required: order is not a draft' using errcode = '22023';
  end if;
  if not private.order_recommendation_sources_are_current(p_restaurant_id, p_order_id) then
    raise exception 'Supplier send approval required: recommendation evidence changed; regenerate the draft'
      using errcode = '22023';
  end if;

  select * into connection from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail' for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    raise exception 'Supplier send approval required: Gmail sender is unavailable' using errcode = '22023';
  end if;
  select supplier.* into recipient from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name))
    and supplier.email is not null
  order by supplier.created_at, supplier.id limit 1 for update;
  if not found then
    raise exception 'Supplier send approval required: supplier recipient is unavailable' using errcode = '22023';
  end if;
  select restaurant.name into restaurant_name from public.restaurants restaurant
  where restaurant.id = p_restaurant_id for share;
  if not found then
    raise exception 'Supplier send approval required: restaurant is unavailable' using errcode = '22023';
  end if;

  current_from := lower(trim(connection.sender_email));
  current_to := lower(trim(recipient.email));
  current_subject := restaurant_name || ' order for ' || order_row.supplier_name;
  current_body_hash := pg_catalog.encode(
    public.digest(pg_catalog.convert_to(order_row.order_message, 'UTF8'), 'sha256'), 'hex'
  );
  if current_from <> reviewed_from or current_to <> reviewed_to
    or current_subject <> reviewed_subject
  then raise exception 'Supplier send approval required: delivery envelope changed' using errcode = '22023'; end if;

  if action_row.status <> 'approved' then
    action_row := public.decide_mise_action(p_restaurant_id, p_action_id, 'approved');
  end if;
  update public.mise_actions action
  set approved_by = auth.uid(),
    expected_impact = coalesce(action.expected_impact, '{}'::jsonb) || jsonb_build_object(
      'approvedEnvelope', jsonb_build_object(
        'from', current_from, 'to', current_to, 'subject', current_subject,
        'bodyHash', current_body_hash, 'reviewedAt', now()
      )
    ), updated_at = now()
  where action.restaurant_id = p_restaurant_id and action.id = p_action_id
  returning * into action_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_send_envelope_approved',
    'mise_actions', p_action_id,
    jsonb_build_object(
      'supplier_order_id', p_order_id,
      'body_hash', current_body_hash
    )
  );
  return action_row;
end;
$$;

create or replace function private.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  action_row public.mise_actions%rowtype;
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  credential private.gmail_credentials%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  approved_envelope jsonb;
  current_from text;
  current_to text;
  current_subject text;
  current_body_hash text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Supplier email access denied' using errcode = '42501'; end if;

  select * into system_controls from public.system_operational_controls where singleton;
  if not found or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
  then return jsonb_build_object('outcome', 'provider_not_enabled'); end if;
  select * into restaurant_controls from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id;
  if not found or not restaurant_controls.gmail_delivery_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  if not found then return jsonb_build_object('outcome', 'approval_required'); end if;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  if action_row.status = 'executed' then
    return private.service_claim_supplier_email_send_unchecked(
      p_actor_user_id, p_restaurant_id, p_order_id, p_idempotency_key, p_rfc_message_id
    );
  end if;
  approved_envelope := action_row.expected_impact->'approvedEnvelope';
  if action_row.status <> 'approved' or approved_envelope is null
    or jsonb_typeof(approved_envelope) <> 'object'
  then return jsonb_build_object('outcome', 'approval_required'); end if;
  if not private.order_recommendation_sources_are_current(p_restaurant_id, p_order_id) then
    return jsonb_build_object('outcome', 'approval_required');
  end if;

  select * into connection from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail' for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;
  select * into credential from private.gmail_credentials gmail_credential
  where gmail_credential.restaurant_id = p_restaurant_id for update;
  if not found or credential.sender_email <> lower(connection.sender_email) then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;
  select supplier.* into recipient from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name))
    and supplier.email is not null
  order by supplier.created_at, supplier.id limit 1 for update;
  if not found then return jsonb_build_object('outcome', 'supplier_email_missing'); end if;
  if recipient.email ~ '[[:cntrl:]]'
    or recipient.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(recipient.email) > 254
  then return jsonb_build_object('outcome', 'supplier_email_invalid'); end if;
  select restaurant.name into restaurant_name from public.restaurants restaurant
  where restaurant.id = p_restaurant_id for share;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;

  current_from := lower(trim(credential.sender_email));
  current_to := lower(trim(recipient.email));
  current_subject := restaurant_name || ' order for ' || order_row.supplier_name;
  current_body_hash := pg_catalog.encode(
    public.digest(pg_catalog.convert_to(order_row.order_message, 'UTF8'), 'sha256'), 'hex'
  );
  if lower(trim(approved_envelope->>'from')) is distinct from current_from
    or lower(trim(approved_envelope->>'to')) is distinct from current_to
    or approved_envelope->>'subject' is distinct from current_subject
    or approved_envelope->>'bodyHash' is distinct from current_body_hash
  then return jsonb_build_object('outcome', 'approval_required'); end if;

  return private.service_claim_supplier_email_send_unchecked(
    p_actor_user_id, p_restaurant_id, p_order_id, p_idempotency_key, p_rfc_message_id
  );
end;
$$;

revoke all on function public.approve_supplier_send_envelope(uuid, uuid, uuid, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.approve_supplier_send_envelope(uuid, uuid, uuid, text, text, text)
to authenticated;
revoke all on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;

comment on column public.pos_locations.selected_for_planning is
  'Exactly one active Square location may be selected per integration for live planning.';
comment on column public.purchase_recommendations.source_evidence is
  'Bounded, revision-bound source evidence revalidated before approval, drafting, and send.';
