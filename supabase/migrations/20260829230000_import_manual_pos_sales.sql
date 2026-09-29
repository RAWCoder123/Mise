-- Post-setup Manual CSV sales import.
-- Day-0 `save_restaurant_setup` rejects non-fingerprint replays after
-- setup_completed, which left Settings → Sales Import as a dead path.
-- This RPC upserts Manual CSV Upload rows and records a sales_imports ledger
-- entry without reopening the setup fingerprint gate.

create or replace function public.import_manual_pos_sales(
  p_restaurant_id uuid,
  p_pos_sales jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_sales jsonb := coalesce(p_pos_sales, '[]'::jsonb);
  payload record;
  sale_count integer := 0;
  import_id uuid := gen_random_uuid();
  sales_length integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if jsonb_typeof(safe_sales) <> 'array' then
    raise exception 'POS sales payload must be an array' using errcode = '22023';
  end if;

  sales_length := pg_catalog.jsonb_array_length(safe_sales);
  if sales_length < 1 then
    raise exception 'Paste at least one valid sales row before importing.' using errcode = '22023';
  end if;
  if sales_length > 1000 then
    raise exception 'POS import is limited to 1000 rows.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1fmanual_pos_sales_import',
      0
    )
  );

  insert into public.sales_imports (
    id,
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
    import_id,
    p_restaurant_id,
    null,
    'csv_upload',
    'processing',
    null,
    0,
    null,
    pg_catalog.jsonb_build_object(
      'source', 'manual_csv_import',
      'storage_status', 'rows_only',
      'raw_file_stored', false
    ),
    now()
  );

  for payload in
    select * from pg_catalog.jsonb_to_recordset(safe_sales) as value(
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
    payload.source_record_id := pg_catalog.btrim(payload.source_record_id);
    payload.item_name := pg_catalog.btrim(payload.item_name);
    payload.category := pg_catalog.btrim(payload.category);
    payload.source_pos := pg_catalog.btrim(payload.source_pos);
    if pg_catalog.length(payload.source_record_id) not between 1 and 200
      or payload.sale_date is null
      or pg_catalog.length(payload.item_name) not between 1 and 200
      or pg_catalog.length(payload.category) not between 1 and 120
      or payload.quantity_sold is null or payload.quantity_sold <= 0
      or payload.quantity_sold > 100000
      or payload.gross_sales is null or payload.gross_sales not between 0 and 10000000
      or payload.net_sales is null or payload.net_sales not between 0 and 10000000
      or payload.source_pos <> 'Manual CSV Upload'
    then
      raise exception 'Invalid POS import row' using errcode = '22023';
    end if;

    insert into public.pos_sales (
      restaurant_id, source_record_id, sale_date, item_name, category,
      quantity_sold, gross_sales, net_sales, source_pos
    ) values (
      p_restaurant_id, payload.source_record_id, payload.sale_date,
      payload.item_name, payload.category, payload.quantity_sold,
      payload.gross_sales, payload.net_sales, payload.source_pos
    ) on conflict (restaurant_id, source_pos, source_record_id)
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
  set status = 'completed',
      records_processed = sale_count,
      imported_at = now()
  where id = import_id
    and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    auth.uid(),
    'manual_pos_sales_imported',
    'sales_imports',
    import_id,
    pg_catalog.jsonb_build_object(
      'pos_sales_rows_saved', sale_count,
      'source_pos', 'Manual CSV Upload'
    )
  );

  return pg_catalog.jsonb_build_object(
    'pos_sales_rows_saved', sale_count,
    'import_id', import_id
  );
end;
$$;

revoke all on function public.import_manual_pos_sales(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.import_manual_pos_sales(uuid, jsonb)
  to authenticated;
