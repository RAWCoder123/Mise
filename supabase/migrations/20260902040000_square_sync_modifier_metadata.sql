-- Persist bounded Square line-item modifier observations on sales_imports
-- metadata during sync. Sale rows stay flat; this does not deplete inventory
-- or invent modifier mapping authority.

create or replace function private.normalize_square_modifier_sync_summary(
  p_summary jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  sample jsonb := '[]'::jsonb;
  entry jsonb;
  entry_id text;
  entry_name text;
  entry_count numeric;
  observed_count numeric := 0;
  unique_count integer := 0;
  sample_count integer := 0;
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then
    return jsonb_build_object(
      'modifiers_observed_count', 0,
      'modifiers_unique_count', 0,
      'modifiers_sample', '[]'::jsonb
    );
  end if;

  observed_count := least(
    1000000::numeric,
    greatest(
      0::numeric,
      coalesce((p_summary->>'modifiers_observed_count')::numeric, 0)
    )
  );
  unique_count := least(
    100000,
    greatest(0, coalesce((p_summary->>'modifiers_unique_count')::integer, 0))
  );

  if jsonb_typeof(p_summary->'modifiers_sample') = 'array' then
    for entry in
      select value
      from jsonb_array_elements(p_summary->'modifiers_sample')
    loop
      exit when sample_count >= 20;
      if jsonb_typeof(entry) <> 'object' then
        continue;
      end if;
      entry_id := left(trim(coalesce(entry->>'id', '')), 128);
      entry_name := left(trim(coalesce(entry->>'name', '')), 160);
      entry_count := least(
        100000::numeric,
        greatest(0::numeric, coalesce((entry->>'count')::numeric, 0))
      );
      if entry_id = '' or entry_name = '' or entry_count <= 0 then
        continue;
      end if;
      sample := sample || jsonb_build_array(
        jsonb_build_object(
          'id', entry_id,
          'name', entry_name,
          'count', floor(entry_count)
        )
      );
      sample_count := sample_count + 1;
    end loop;
  end if;

  if unique_count < sample_count then
    unique_count := sample_count;
  end if;

  return jsonb_build_object(
    'modifiers_observed_count', floor(observed_count),
    'modifiers_unique_count', unique_count,
    'modifiers_sample', sample
  );
end;
$$;

revoke all on function private.normalize_square_modifier_sync_summary(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.normalize_square_modifier_sync_summary(jsonb)
  to service_role;

drop function if exists public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
);
drop function if exists private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date
);

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

-- Keep the historical 10-arg wrapper callable without an explicit summary.
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
    p_to,
    '{}'::jsonb
  );
end;
$$;

revoke all on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) from public, anon, authenticated, service_role;

grant execute on function private.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) to service_role;
grant execute on function public.service_apply_square_sync_result_scoped(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, date, date, jsonb
) to service_role;
