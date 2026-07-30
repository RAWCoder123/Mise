-- Bounded manual CSV POS sales ingest for private beta.
-- Writes go only through service-owned RPCs; live POS sync remains fail-closed.

create or replace function private.service_ingest_manual_pos_sales(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_sales jsonb,
  p_source_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_sales jsonb := coalesce(p_sales, '[]'::jsonb);
  sale_count integer := 0;
  payload record;
  integration_id uuid;
  import_id uuid;
  imported_at timestamptz := clock_timestamp();
  safe_file_name text := nullif(trim(coalesce(p_source_file_name, '')), '');
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if jsonb_typeof(safe_sales) <> 'array' then
    raise exception 'POS sales payload must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(safe_sales) < 1 or jsonb_array_length(safe_sales) > 1000 then
    raise exception 'POS CSV ingest accepts between 1 and 1000 sales rows' using errcode = '22023';
  end if;
  if safe_file_name is not null and length(safe_file_name) > 240 then
    raise exception 'Source file name is too long' using errcode = '22023';
  end if;

  insert into public.pos_integrations (
    restaurant_id,
    provider,
    status,
    external_location_id,
    last_sync_at,
    sync_cursor,
    settings,
    updated_at
  ) values (
    p_restaurant_id,
    'manual_csv',
    'connected',
    null,
    imported_at,
    null,
    jsonb_build_object(
      'mode', 'manual_csv',
      'importsSales', true,
      'storesCredentials', false
    ),
    imported_at
  )
  on conflict (restaurant_id, provider) do update
  set status = 'connected',
      last_sync_at = excluded.last_sync_at,
      settings = excluded.settings,
      updated_at = excluded.updated_at
  returning id into integration_id;

  insert into public.sales_imports (
    restaurant_id,
    pos_integration_id,
    import_type,
    status,
    source_file_name,
    records_processed,
    error_message,
    metadata,
    imported_at
  ) values (
    p_restaurant_id,
    integration_id,
    'csv_upload',
    'completed',
    safe_file_name,
    0,
    null,
    jsonb_build_object(
      'source', 'manual_csv_ingest',
      'storage_status', 'rows_only',
      'raw_file_stored', false
    ),
    imported_at
  )
  returning id into import_id;

  for payload in
    select * from jsonb_to_recordset(safe_sales) as value(
      source_record_id text,
      sale_date date,
      item_name text,
      category text,
      quantity_sold numeric,
      gross_sales numeric,
      net_sales numeric,
      source_pos text
    )
  loop
    payload.source_record_id := trim(payload.source_record_id);
    payload.item_name := trim(payload.item_name);
    payload.category := trim(payload.category);
    payload.source_pos := trim(payload.source_pos);

    if length(payload.source_record_id) not between 1 and 200
       or payload.sale_date is null
       or length(payload.item_name) not between 1 and 200
       or length(payload.category) not between 1 and 120
       or payload.quantity_sold is null or payload.quantity_sold <= 0 or payload.quantity_sold > 100000
       or payload.gross_sales is null or payload.gross_sales not between 0 and 10000000
       or payload.net_sales is null or payload.net_sales not between 0 and 10000000
       or payload.source_pos <> 'Manual CSV Upload' then
      raise exception 'Invalid POS CSV ingest row' using errcode = '22023';
    end if;

    insert into public.pos_sales (
      restaurant_id, source_record_id, sale_date, item_name, category,
      quantity_sold, gross_sales, net_sales, source_pos
    ) values (
      p_restaurant_id, payload.source_record_id, payload.sale_date,
      payload.item_name, payload.category, payload.quantity_sold,
      payload.gross_sales, payload.net_sales, payload.source_pos
    )
    on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set
      sale_date = excluded.sale_date,
      item_name = excluded.item_name,
      category = excluded.category,
      quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales,
      net_sales = excluded.net_sales;
    sale_count := sale_count + 1;
  end loop;

  update public.sales_imports
  set records_processed = sale_count
  where id = import_id
    and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    p_actor_user_id,
    'manual_pos_csv_ingested',
    'sales_imports',
    import_id,
    jsonb_build_object(
      'pos_sales_rows_saved', sale_count,
      'pos_integration_id', integration_id,
      'source_file_name', safe_file_name
    )
  );

  return jsonb_build_object(
    'pos_sales_rows_saved', sale_count,
    'sales_import_id', import_id,
    'pos_integration_id', integration_id,
    'provider', 'manual_csv'
  );
end;
$$;

create or replace function public.service_ingest_manual_pos_sales(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_sales jsonb,
  p_source_file_name text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_ingest_manual_pos_sales(
    p_actor_user_id,
    p_restaurant_id,
    p_sales,
    p_source_file_name
  );
$$;

revoke all on function private.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;

grant execute on function private.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text)
  to service_role;
grant execute on function public.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text)
  to service_role;

comment on function private.service_ingest_manual_pos_sales(uuid, uuid, jsonb, text) is
  'Service-only bounded manual CSV POS sales ingest with idempotent source_record_id upserts.';
