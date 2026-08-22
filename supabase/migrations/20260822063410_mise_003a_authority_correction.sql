-- MISE-003A correction round: provider completeness is independent of observed
-- sale rows, Square work has an explicit database-visible synchronization
-- boundary, partial refreshes cannot attest a purchasing window, and draft
-- mutation revalidates the complete current line set.

alter table public.pos_integrations
  add column if not exists authority_sync_token uuid,
  add column if not exists authority_sync_started_at timestamptz,
  add column if not exists authority_sync_mode text,
  add column if not exists authority_sync_window_from date,
  add column if not exists authority_sync_window_to date,
  add column if not exists authority_sync_location_ids text[];

alter table public.pos_integrations
  drop constraint if exists pos_integrations_authority_sync_state_check;
alter table public.pos_integrations
  add constraint pos_integrations_authority_sync_state_check check (
    (
      authority_sync_token is null
      and authority_sync_started_at is null
      and authority_sync_mode is null
      and authority_sync_window_from is null
      and authority_sync_window_to is null
      and authority_sync_location_ids is null
    )
    or (
      authority_sync_token is not null
      and authority_sync_started_at is not null
      and authority_sync_mode in ('full', 'partial')
      and authority_sync_window_from is not null
      and authority_sync_window_to is not null
      and authority_sync_window_to >= authority_sync_window_from
      and authority_sync_location_ids is not null
      and cardinality(authority_sync_location_ids) > 0
    )
  );

comment on column public.pos_integrations.authority_sync_token is
  'Opaque lease committed before Square HTTP work. Purchase approval blocks while it is present.';
comment on column public.pos_integrations.authority_sync_mode is
  'full may attest the exact current 28-day window; partial always invalidates purchasing completeness.';

drop trigger if exists pos_integrations_bump_planning_revision on public.pos_integrations;
create trigger pos_integrations_bump_planning_revision
after insert or delete or update of status, external_location_id, last_sync_at,
  authority_window_from, authority_window_to, authority_window_completed_at,
  authority_sync_token, authority_sync_started_at, authority_sync_mode,
  authority_sync_window_from, authority_sync_window_to, authority_sync_location_ids
on public.pos_integrations
for each row execute function private.bump_restaurant_planning_revision();

-- Keep the reviewed implementations as non-callable building blocks. The
-- correction wrappers below become the only trusted entry points.
alter function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) rename to service_apply_square_sync_result_mise_003a_base;

revoke all on function private.service_apply_square_sync_result_mise_003a_base(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

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
      or sale_source_record_id ~ '[[:cntrl:]]'
    then
      raise exception 'Square sale record identity is invalid' using errcode = '22023';
    end if;
    if p_require_complete and (
      item_name is null or length(item_name) > 160 or item_name ~ '[[:cntrl:]]'
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
      or coalesce(incoming_location_id, '') ~ '[[:cntrl:]]'
      or coalesce(incoming_variation_id, '') ~ '[[:cntrl:]]'
      or coalesce(incoming_catalog_item_id, '') ~ '[[:cntrl:]]'
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
      length(derived_catalog_item_id) > 128 or derived_catalog_item_id ~ '[[:cntrl:]]'
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

create or replace function private.service_begin_square_authority_sync(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_snapshot_mode text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  integration public.pos_integrations%rowtype;
  operating_date date;
  sync_token uuid := gen_random_uuid();
  started_at timestamptz := clock_timestamp();
  active_location_ids text[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_snapshot_mode not in ('full', 'partial')
    or p_from is null or p_to is null or p_to < p_from
    or p_to - p_from > 31
  then
    raise exception 'Square sync boundary is invalid' using errcode = '22023';
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
  if integration.authority_sync_token is not null
    and integration.authority_sync_started_at > started_at - interval '30 minutes'
  then
    raise exception 'Square authority sync already in progress' using errcode = '40001';
  end if;
  select coalesce(array_agg(location.external_location_id order by location.external_location_id), '{}')
  into active_location_ids
  from public.pos_locations location
    where location.restaurant_id = p_restaurant_id
      and location.pos_integration_id = p_integration_id
      and location.status = 'active';
  if cardinality(active_location_ids) = 0 then
    raise exception 'Square authority sync requires an active location' using errcode = '22023';
  end if;

  begin
    select timezone(restaurant.timezone, started_at)::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := started_at::date;
  end;
  operating_date := coalesce(operating_date, started_at::date);
  if p_snapshot_mode = 'full'
    and (p_from <> operating_date - 27 or p_to <> operating_date)
  then
    raise exception 'Full Square authority sync must cover the exact current 28-day window'
      using errcode = '22023';
  end if;

  update public.pos_integrations
  set authority_sync_token = sync_token,
    authority_sync_started_at = started_at,
    authority_sync_mode = p_snapshot_mode,
    authority_sync_window_from = p_from,
    authority_sync_window_to = p_to,
    authority_sync_location_ids = active_location_ids,
    authority_window_from = case when p_snapshot_mode = 'partial' then null else authority_window_from end,
    authority_window_to = case when p_snapshot_mode = 'partial' then null else authority_window_to end,
    authority_window_completed_at = case
      when p_snapshot_mode = 'partial' then null else authority_window_completed_at end,
    updated_at = started_at
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  return jsonb_build_object(
    'syncToken', sync_token,
    'snapshotMode', p_snapshot_mode,
    'windowFrom', p_from,
    'windowTo', p_to,
    'locationIds', to_jsonb(active_location_ids),
    'startedAt', started_at
  );
end;
$$;

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
  integration public.pos_integrations%rowtype;
  prepared_sales jsonb;
  applied jsonb;
  import_id uuid;
  completed_at timestamptz;
  active_location_ids text[];
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

  -- The base apply always updates the integration and therefore holds the
  -- restaurant planning-revision row through commit. Rechecking here makes a
  -- location change linearize before this completion or after it, never inside
  -- an attested snapshot.
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
    )
    where id = import_id and restaurant_id = p_restaurant_id;
    update public.audit_logs
    set metadata = metadata || jsonb_build_object(
      'snapshot_mode', p_snapshot_mode,
      'authority_window_attested', p_snapshot_mode = 'full'
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
      when p_snapshot_mode = 'full' then to_jsonb(completed_at) else 'null'::jsonb end
  );
end;
$$;

create or replace function private.service_fail_square_authority_sync(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sync_token uuid,
  p_error_code text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  integration public.pos_integrations%rowtype;
  import_id uuid := gen_random_uuid();
  safe_code text := private.gmail_safe_error_code(p_error_code);
  failed_at timestamptz := clock_timestamp();
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sync_token is null then
    raise exception 'Square sync failure boundary is invalid' using errcode = '22023';
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
  if integration.authority_sync_token is distinct from p_sync_token then
    return jsonb_build_object('status', 'superseded');
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, error_message, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'failed',
    0, left(safe_code, 200),
    jsonb_build_object(
      'provider', 'square',
      'from', p_from,
      'to', p_to,
      'reason', safe_code,
      'snapshot_mode', integration.authority_sync_mode,
      'authority_window_attested', false
    ),
    failed_at
  );

  update public.pos_integrations
  set status = 'error',
    authority_sync_token = null,
    authority_sync_started_at = null,
    authority_sync_mode = null,
    authority_sync_window_from = null,
    authority_sync_window_to = null,
    authority_sync_location_ids = null,
    updated_at = failed_at
  where id = p_integration_id
    and restaurant_id = p_restaurant_id
    and authority_sync_token = p_sync_token;

  return jsonb_build_object(
    'importId', import_id,
    'status', 'failed',
    'reason', safe_code
  );
end;
$$;

-- The historical service RPC remains usable for non-authoritative imports, but
-- it is deliberately downgraded to partial semantics. Only the explicit
-- begin/apply pair below can establish a full purchasing window.
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
  boundary jsonb;
  sync_token uuid;
begin
  boundary := private.service_begin_square_authority_sync(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    'partial',
    p_from,
    p_to
  );
  sync_token := (boundary->>'syncToken')::uuid;
  return private.service_apply_square_sync_result_scoped(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    sync_token,
    'partial',
    p_sales,
    p_catalog_items,
    p_sync_cursor,
    p_from,
    p_to
  );
end;
$$;

create or replace function public.service_begin_square_authority_sync(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_snapshot_mode text,
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_begin_square_authority_sync(
    p_actor_user_id, p_restaurant_id, p_integration_id, p_snapshot_mode, p_from, p_to
  );
$$;

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
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_apply_square_sync_result_scoped(
    p_actor_user_id, p_restaurant_id, p_integration_id, p_sync_token,
    p_snapshot_mode, p_sales, p_catalog_items, p_sync_cursor, p_from, p_to
  );
$$;

create or replace function public.service_fail_square_authority_sync(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sync_token uuid,
  p_error_code text,
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_fail_square_authority_sync(
    p_actor_user_id, p_restaurant_id, p_integration_id, p_sync_token,
    p_error_code, p_from, p_to
  );
$$;

create or replace function public.service_apply_square_sync_result(
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
language sql
security invoker
set search_path = ''
as $$
  select private.service_apply_square_sync_result(
    p_actor_user_id, p_restaurant_id, p_integration_id,
    p_sales, p_catalog_items, p_sync_cursor, p_from, p_to
  );
$$;

revoke all on function private.service_begin_square_authority_sync(
  uuid, uuid, uuid, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function private.service_fail_square_authority_sync(
  uuid, uuid, uuid, uuid, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_begin_square_authority_sync(
  uuid, uuid, uuid, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_fail_square_authority_sync(
  uuid, uuid, uuid, uuid, text, date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) from public, anon, authenticated, service_role;

grant execute on function private.service_begin_square_authority_sync(
  uuid, uuid, uuid, text, date, date
) to service_role;
grant execute on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) to service_role;
grant execute on function private.service_fail_square_authority_sync(
  uuid, uuid, uuid, uuid, text, date, date
) to service_role;
grant execute on function private.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;
grant execute on function public.service_begin_square_authority_sync(
  uuid, uuid, uuid, text, date, date
) to service_role;
grant execute on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
) to service_role;
grant execute on function public.service_fail_square_authority_sync(
  uuid, uuid, uuid, uuid, text, date, date
) to service_role;
grant execute on function public.service_apply_square_sync_result(
  uuid, uuid, uuid, jsonb, jsonb, text, date, date
) to service_role;

alter function private.evaluate_purchase_recommendation_authority(
  uuid, uuid, timestamptz
) rename to evaluate_purchase_recommendation_authority_mise_003a_base;

revoke all on function private.evaluate_purchase_recommendation_authority_mise_003a_base(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

-- UNKNOWN is never inferred to mean zero. The reviewed evaluator remains the
-- complete item/recipe/mapping implementation; this wrapper moves Square
-- connection/window readiness outside its observed-row conditional and adds a
-- bounded recommendation demand basis.
create or replace function private.evaluate_purchase_recommendation_authority(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_evaluated_at timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority jsonb;
  blockers jsonb;
  evidence jsonb;
  recommendation_row public.purchase_recommendations%rowtype;
  square_integration public.pos_integrations%rowtype;
  square_configured boolean := false;
  operating_date date;
  history_service_days integer := 0;
  history_observations integer := 0;
  demand_basis text;
begin
  authority := private.evaluate_purchase_recommendation_authority_mise_003a_base(
    p_restaurant_id, p_recommendation_id, p_evaluated_at
  );
  blockers := coalesce(authority->'blockers', '[]'::jsonb);
  evidence := coalesce(authority->'evidence', '{}'::jsonb);

  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then
    raise exception 'Recommendation not found' using errcode = '22023';
  end if;

  begin
    select timezone(restaurant.timezone, p_evaluated_at)::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := p_evaluated_at::date;
  end;
  operating_date := coalesce(operating_date, p_evaluated_at::date);

  select * into square_integration
  from public.pos_integrations integration
  where integration.restaurant_id = p_restaurant_id
    and integration.provider = 'square';
  square_configured := found;

  if square_configured then
    if square_integration.authority_sync_token is not null then
      blockers := private.append_purchase_authority_blocker(
        blockers,
        'pos_sync_in_progress',
        'Square authority evidence is currently being synchronized.',
        jsonb_build_object(
          'snapshotMode', square_integration.authority_sync_mode,
          'startedAt', square_integration.authority_sync_started_at
        )
      );
    end if;

    if square_integration.status <> 'connected' or not exists (
      select 1 from public.pos_locations location
      where location.restaurant_id = p_restaurant_id
        and location.pos_integration_id = square_integration.id
        and location.status = 'active'
    ) then
      blockers := private.append_purchase_authority_blocker(
        blockers,
        'pos_not_connected',
        'Square and at least one purchasing-authority location must be active.',
        '{}'::jsonb
      );
    end if;

    if square_integration.authority_window_from is distinct from operating_date - 27
      or square_integration.authority_window_to is distinct from operating_date
      or square_integration.authority_window_completed_at is null
      or square_integration.authority_window_completed_at > p_evaluated_at + interval '2 minutes'
    then
      blockers := private.append_purchase_authority_blocker(
        blockers,
        'planning_window_incomplete',
        'Run a complete exact 28-day Square snapshot before approval.',
        jsonb_build_object(
          'requiredFrom', operating_date - 27,
          'requiredTo', operating_date
        )
      );
    end if;

    if square_integration.status <> 'connected'
      or square_integration.last_sync_at is null
      or square_integration.authority_window_completed_at is null
      or p_evaluated_at - square_integration.last_sync_at > interval '24 hours'
      or p_evaluated_at - square_integration.authority_window_completed_at > interval '24 hours'
      or square_integration.last_sync_at > p_evaluated_at + interval '2 minutes'
      or square_integration.authority_window_completed_at > p_evaluated_at + interval '2 minutes'
    then
      blockers := private.append_purchase_authority_blocker(
        blockers,
        'pos_sync_stale',
        'Square has not completed a fresh full authority snapshot in the last 24 hours.',
        '{}'::jsonb
      );
    end if;
  end if;

  if square_configured and recommendation_row.generation_source in ('mise_rules', 'legacy_client') then
    select
      count(distinct sale.sale_date) filter (where sale.sale_date < operating_date),
      count(*) filter (where sale.sale_date < operating_date)
    into history_service_days, history_observations
    from public.pos_sales sale
    join lateral (
      select min(mapping.menu_item_id::text)::uuid as menu_item_id,
        count(*) as mapping_count
      from public.pos_catalog_item_mappings mapping
      join public.pos_locations location
        on location.restaurant_id = p_restaurant_id
        and location.id = mapping.pos_location_id
        and location.status = 'active'
        and location.external_location_id = sale.provider_location_id
      join public.pos_integrations mapping_integration
        on mapping_integration.restaurant_id = p_restaurant_id
        and mapping_integration.id = location.pos_integration_id
        and mapping_integration.provider = 'square'
        and mapping_integration.status = 'connected'
      where mapping.restaurant_id = p_restaurant_id
        and mapping.external_catalog_item_id = sale.provider_catalog_item_id
        and mapping.external_variation_id = sale.provider_variation_id
        and mapping.verification_status = 'verified'
        and mapping.effective_from <= p_evaluated_at
        and (mapping.effective_to is null or mapping.effective_to > p_evaluated_at)
    ) exact_mapping on exact_mapping.mapping_count = 1
    where sale.restaurant_id = p_restaurant_id
      and sale.sale_date between operating_date - 27 and operating_date
      and lower(trim(coalesce(sale.source_pos, ''))) = 'square'
      and exists (
        select 1 from public.menu_item_ingredients ingredient
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.menu_item_id = exact_mapping.menu_item_id
          and ingredient.inventory_item_id = recommendation_row.inventory_item_id
      );

    history_service_days := coalesce(history_service_days, 0);
    history_observations := coalesce(history_observations, 0);
    if history_service_days < 7 or history_observations < 3 then
      blockers := private.append_purchase_authority_blocker(
        blockers,
        'demand_history_insufficient',
        'MISE-generated demand needs at least seven verified service days and three observations.',
        jsonb_build_object(
          'serviceDays', history_service_days,
          'observations', history_observations
        )
      );
    end if;
  end if;

  demand_basis := case
    when recommendation_row.generation_source in ('mise_rules', 'legacy_client') and square_configured
      then 'square_history_required'
    when recommendation_row.generation_source in ('mise_rules', 'legacy_client')
      then 'non_provider_planning'
    else 'manual_physical_stock'
  end;
  evidence := evidence || jsonb_build_object(
    'providerWindowFrom', case when square_configured then square_integration.authority_window_from else null end,
    'providerWindowTo', case when square_configured then square_integration.authority_window_to else null end,
    'providerWindowCompletedAt', case
      when square_configured then square_integration.authority_window_completed_at else null end,
    'demandBasis', demand_basis
  );

  authority := jsonb_set(authority, '{blockers}', blockers, true);
  authority := jsonb_set(authority, '{evidence}', evidence, true);
  authority := jsonb_set(
    authority,
    '{ready}',
    to_jsonb(jsonb_array_length(blockers) = 0),
    true
  );
  return authority;
end;
$$;

revoke all on function private.evaluate_purchase_recommendation_authority(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;

create or replace function public.list_purchase_recommendation_authority(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  results jsonb := '{}'::jsonb;
  evaluated_at timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  for recommendation_row in
    select recommendation.*
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.status = 'pending'
      and (
        recommendation.generation_source = 'manual'
        or private.signals_are_current(recommendation.restaurant_id, recommendation.planning_revision)
      )
    order by recommendation.created_at desc, recommendation.id
    limit 250
  loop
    results := results || jsonb_build_object(
      recommendation_row.id::text,
      private.evaluate_purchase_recommendation_authority(
        p_restaurant_id, recommendation_row.id, evaluated_at
      )
    );
  end loop;
  return results;
end;
$$;

revoke all on function public.list_purchase_recommendation_authority(uuid) from public, anon;
grant execute on function public.list_purchase_recommendation_authority(uuid) to authenticated;

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
  existing_line record;
  previous_status text;
  authority jsonb;
  existing_authority jsonb;
  evaluated_at timestamptz;
  approved_quantity numeric;
  suggested_quantity numeric;
  was_quantity_overridden boolean;
  blocker_codes jsonb;
  draft_authority_refresh jsonb := '{}'::jsonb;
  revalidated_line_count integer := 0;
  stale_line_count integer := 0;
  first_stale_line_id uuid;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is not null and (
    p_recommended_quantity <= 0
    or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('dismissed', 'ordered') then
    raise exception 'Already handled';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || recommendation_row.supplier_name, 0)
  );
  if recommendation_row.status = 'approved' then
    select * into order_row
    from public.supplier_orders order_record
    where order_record.restaurant_id = p_restaurant_id
      and order_record.id = recommendation_row.supplier_order_id
    for update;
    return jsonb_build_object(
      'outcome', 'already_applied',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', case when order_row.id is null then null else to_jsonb(order_row) end,
      'authority', recommendation_row.approval_authority
    );
  end if;

  -- Resolve and lock the exact existing draft before evidence evaluation. The
  -- same supplier advisory lock serializes approval/undo attachment changes.
  if recommendation_row.supplier_order_id is not null then
    select * into order_row
    from public.supplier_orders linked_order
    where linked_order.restaurant_id = p_restaurant_id
      and linked_order.id = recommendation_row.supplier_order_id
    for update;
  end if;
  if order_row.id is null then
    select * into order_row
    from public.supplier_orders existing_order
    where existing_order.restaurant_id = p_restaurant_id
      and existing_order.supplier_name = recommendation_row.supplier_name
      and existing_order.status = 'draft'
    order by existing_order.created_at desc, existing_order.id desc
    limit 1
    for update;
  end if;

  -- Authority writers take the underlying rows before the shared planning
  -- revision. Triggers take those rows first and bump the revision last, so an
  -- overlapping write is ordered before or after this action without a lock
  -- inversion. Inventory-item locks also serialize event projection writers.
  perform 1
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and (
      item.id = recommendation_row.inventory_item_id
      or (
        order_row.id is not null
        and exists (
          select 1 from public.purchase_recommendations attached
          where attached.restaurant_id = p_restaurant_id
            and attached.supplier_order_id = order_row.id
            and attached.status = 'approved'
            and attached.inventory_item_id = item.id
        )
      )
    )
  order by item.id
  for update;
  perform 1 from public.system_operational_controls controls
    where controls.singleton for share;
  perform 1 from public.restaurant_operational_controls controls
    where controls.restaurant_id = p_restaurant_id for share;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id
    order by integration.id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id
    order by location.id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id
    order by mapping.id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id
    order by menu_item.id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id
    order by ingredient.id for share;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;

  evaluated_at := clock_timestamp();
  authority := private.evaluate_purchase_recommendation_authority(
    p_restaurant_id, p_recommendation_id, evaluated_at
  );

  if coalesce((authority->>'ready')::boolean, false) and order_row.id is not null then
    for existing_line in
      select attached.id
      from public.purchase_recommendations attached
      where attached.restaurant_id = p_restaurant_id
        and attached.supplier_order_id = order_row.id
        and attached.status = 'approved'
        and attached.id <> p_recommendation_id
      order by attached.id
    loop
      existing_authority := private.evaluate_purchase_recommendation_authority(
        p_restaurant_id, existing_line.id, evaluated_at
      );
      if coalesce((existing_authority->>'ready')::boolean, false) then
        revalidated_line_count := revalidated_line_count + 1;
        draft_authority_refresh := draft_authority_refresh
          || jsonb_build_object(existing_line.id::text, existing_authority);
      else
        stale_line_count := stale_line_count + 1;
        first_stale_line_id := coalesce(first_stale_line_id, existing_line.id);
      end if;
    end loop;

    if stale_line_count > 0 then
      authority := jsonb_set(
        authority,
        '{blockers}',
        private.append_purchase_authority_blocker(
          authority->'blockers',
          'draft_authority_stale',
          'An approved line in this supplier draft no longer has current purchase authority.',
          jsonb_build_object(
            'supplierOrderId', order_row.id,
            'staleLineCount', stale_line_count,
            'firstStaleRecommendationId', first_stale_line_id
          )
        ),
        true
      );
      authority := jsonb_set(authority, '{ready}', 'false'::jsonb, true);
    end if;
  end if;

  if not coalesce((authority->>'ready')::boolean, false) then
    select coalesce(jsonb_agg(blocker->>'code' order by blocker->>'code'), '[]'::jsonb)
    into blocker_codes from jsonb_array_elements(authority->'blockers') blocker;
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'purchase_approval_blocked',
      'purchase_recommendations', recommendation_row.id,
      jsonb_build_object(
        'blocker_codes', blocker_codes,
        'planning_revision', authority->'planningRevision'
      )
    );
    return jsonb_build_object(
      'outcome', 'blocked',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', null,
      'authority', authority
    );
  end if;

  approved_quantity := coalesce(p_recommended_quantity, recommendation_row.recommended_quantity);
  suggested_quantity := recommendation_row.recommended_quantity;
  was_quantity_overridden := p_recommended_quantity is not null
    and p_recommended_quantity is distinct from recommendation_row.recommended_quantity;

  if order_row.id is null then
    insert into public.supplier_orders (
      restaurant_id, supplier_name, order_message, operator_note, status,
      delivery_date, purchase_authority, purchase_authority_evaluated_at
    ) values (
      p_restaurant_id, recommendation_row.supplier_name,
      'Order draft for ' || recommendation_row.supplier_name || E'\n\nDelivery requested: Tomorrow morning',
      null, 'draft', current_date + 1, '{}'::jsonb, evaluated_at
    ) returning * into order_row;
  end if;

  update public.purchase_recommendations attached
  set approval_authority = draft_authority_refresh->attached.id::text,
      approval_evaluated_at = evaluated_at
  where attached.restaurant_id = p_restaurant_id
    and attached.supplier_order_id = order_row.id
    and attached.status = 'approved'
    and draft_authority_refresh ? attached.id::text;

  update public.purchase_recommendations
  set status = 'approved',
      recommended_quantity = approved_quantity,
      supplier_order_id = order_row.id,
      approval_authority = authority,
      approval_evaluated_at = evaluated_at,
      quantity_overridden = was_quantity_overridden
  where restaurant_id = p_restaurant_id and id = p_recommendation_id
  returning * into recommendation_row;

  update public.supplier_orders
  set order_message = private.build_supplier_order_message(
        p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
      ),
      purchase_authority = draft_authority_refresh
        || jsonb_build_object(recommendation_row.id::text, authority),
      purchase_authority_evaluated_at = evaluated_at
  where restaurant_id = p_restaurant_id and id = order_row.id
  returning * into order_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recommendation_approved',
    'purchase_recommendations', recommendation_row.id,
    jsonb_build_object(
      'supplier_name', recommendation_row.supplier_name,
      'urgency', recommendation_row.urgency,
      'supplier_order_id', order_row.id,
      'system_suggested_quantity', suggested_quantity,
      'approved_quantity', approved_quantity,
      'quantity_overridden', was_quantity_overridden,
      'authority_evaluated_at', evaluated_at,
      'revalidated_existing_line_count', revalidated_line_count
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', to_jsonb(order_row),
    'authority', authority
  );
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
  from public, anon;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
  to authenticated;
