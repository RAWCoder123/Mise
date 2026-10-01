-- Persist cash-only / non-itemized Square refund attention on the POS integration.
-- Diagnostics only: never invents inventory mutations or negative pos_sales rows.

create or replace function private.service_record_square_non_itemized_refund_attention(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_import_id uuid,
  p_order_count integer,
  p_refund_amount_total numeric,
  p_sample_order_ids text[],
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
  safe_count integer := greatest(0, least(coalesce(p_order_count, 0), 100000));
  safe_amount numeric := greatest(0, least(coalesce(p_refund_amount_total, 0), 10000000));
  safe_sample text[] := coalesce(p_sample_order_ids, array[]::text[]);
  bounded_sample text[] := array[]::text[];
  sample_id text;
  next_settings jsonb;
  detected_at timestamptz := clock_timestamp();
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 31 then
    raise exception 'Square refund attention window is invalid' using errcode = '22023';
  end if;
  if safe_amount <> trunc(safe_amount, 2) then
    raise exception 'Square refund attention amount is invalid' using errcode = '22023';
  end if;

  select * into integration
  from public.pos_integrations candidate
  where candidate.id = p_integration_id
    and candidate.restaurant_id = p_restaurant_id
    and candidate.provider = 'square'
  for update;
  if not found then
    raise exception 'Square integration not found' using errcode = 'P0002';
  end if;

  foreach sample_id in array safe_sample
  loop
    if sample_id is null
      or pg_catalog.length(sample_id) < 1
      or pg_catalog.length(sample_id) > 128
      or sample_id ~ '[[:cntrl:]]'
    then
      continue;
    end if;
    if pg_catalog.cardinality(bounded_sample) >= 5 then
      exit;
    end if;
    bounded_sample := array_append(bounded_sample, sample_id);
  end loop;

  next_settings := coalesce(integration.settings, '{}'::jsonb) - 'nonItemizedRefundAttention';
  if safe_count > 0 then
    next_settings := next_settings || jsonb_build_object(
      'nonItemizedRefundAttention',
      jsonb_build_object(
        'orderCount', safe_count,
        'refundAmountTotal', safe_amount,
        'sampleOrderIds', to_jsonb(bounded_sample),
        'detectedAt', detected_at,
        'windowFrom', p_from,
        'windowTo', p_to,
        'importId', p_import_id
      )
    );
  end if;

  update public.pos_integrations
  set
    settings = next_settings,
    updated_at = detected_at
  where restaurant_id = p_restaurant_id
    and id = p_integration_id;

  if p_import_id is not null then
    update public.sales_imports
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'nonItemizedRefundOrderCount', safe_count,
      'nonItemizedRefundAmountTotal', safe_amount,
      'nonItemizedRefundSampleOrderIds', to_jsonb(bounded_sample)
    )
    where restaurant_id = p_restaurant_id
      and id = p_import_id;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    p_actor_user_id,
    'square_non_itemized_refund_attention',
    'pos_integrations',
    p_integration_id,
    jsonb_build_object(
      'orderCount', safe_count,
      'refundAmountTotal', safe_amount,
      'sampleOrderIds', to_jsonb(bounded_sample),
      'importId', p_import_id,
      'windowFrom', p_from,
      'windowTo', p_to
    )
  );

  return jsonb_build_object(
    'status', 'recorded',
    'orderCount', safe_count,
    'refundAmountTotal', safe_amount,
    'sampleOrderIds', to_jsonb(bounded_sample)
  );
end;
$$;

create or replace function public.service_record_square_non_itemized_refund_attention(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_import_id uuid,
  p_order_count integer,
  p_refund_amount_total numeric,
  p_sample_order_ids text[],
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_square_non_itemized_refund_attention(
    p_actor_user_id,
    p_restaurant_id,
    p_integration_id,
    p_import_id,
    p_order_count,
    p_refund_amount_total,
    p_sample_order_ids,
    p_from,
    p_to
  );
$$;

revoke all on function private.service_record_square_non_itemized_refund_attention(
  uuid, uuid, uuid, uuid, integer, numeric, text[], date, date
) from public, anon, authenticated, service_role;
revoke all on function public.service_record_square_non_itemized_refund_attention(
  uuid, uuid, uuid, uuid, integer, numeric, text[], date, date
) from public, anon, authenticated, service_role;

grant execute on function public.service_record_square_non_itemized_refund_attention(
  uuid, uuid, uuid, uuid, integer, numeric, text[], date, date
) to service_role;
