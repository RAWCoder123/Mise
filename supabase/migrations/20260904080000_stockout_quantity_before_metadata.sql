-- Stockout rows store quantity = 0 while projection zeros on-hand, so the wiped
-- amount never became durable ledger evidence. Server-stamp quantity_before
-- (native) and canonical_quantity_before at insert time from the locked item
-- row, overwrite any client-supplied values for those keys, and compare only
-- client-comparable metadata during record_inventory_event idempotent replay
-- so offline outbox retries still dedupe after the stamp.

create or replace function private.inventory_event_client_comparable_metadata(
  p_metadata jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_metadata, '{}'::jsonb)
    - 'quantity_before'
    - 'canonical_quantity_before';
$$;

create or replace function private.stamp_stockout_inventory_event_quantity_before()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  safe_metadata jsonb;
  quantity_before numeric;
  canonical_quantity_before numeric;
begin
  if new.event_type <> 'stockout' then
    return new;
  end if;

  select item.*
  into item_row
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for stockout quantity_before'
      using errcode = '23503';
  end if;

  if item_row.canonical_quantity_per_unit is null
    or item_row.canonical_quantity_per_unit <= 0
  then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  quantity_before := item_row.current_quantity;
  canonical_quantity_before := quantity_before * item_row.canonical_quantity_per_unit;

  safe_metadata := private.inventory_event_client_comparable_metadata(new.metadata)
    || jsonb_build_object(
      'quantity_before', quantity_before,
      'canonical_quantity_before', canonical_quantity_before
    );

  new.metadata := safe_metadata;
  return new;
end;
$$;

drop trigger if exists stamp_stockout_inventory_event_quantity_before
  on public.inventory_events;
create trigger stamp_stockout_inventory_event_quantity_before
before insert on public.inventory_events
for each row execute function private.stamp_stockout_inventory_event_quantity_before();

create or replace function public.record_inventory_event(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_event_type text,
  p_quantity numeric,
  p_canonical_unit text,
  p_effective_at timestamptz,
  p_source text,
  p_client_event_id text,
  p_idempotency_key text,
  p_source_reference text default null,
  p_reason_code text default null,
  p_supersedes_event_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.inventory_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.inventory_events;
  superseded_event public.inventory_events;
  inserted_event public.inventory_events;
  safe_metadata jsonb := private.inventory_event_client_comparable_metadata(
    coalesce(p_metadata, '{}'::jsonb)
  );
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

  if p_event_type not in (
    'receipt', 'count', 'waste', 'stockout',
    'usage', 'adjustment', 'transfer', 'correction'
  ) then
    raise exception 'Unsupported inventory event type' using errcode = '22023';
  end if;

  if p_canonical_unit not in ('g', 'ml', 'each') then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;

  if p_quantity is null
    or (p_event_type in ('receipt', 'count', 'waste', 'usage') and p_quantity < 0)
    or (p_event_type = 'stockout' and p_quantity <> 0)
  then
    raise exception 'Invalid quantity for inventory event type' using errcode = '22023';
  end if;

  if p_effective_at is null
    or nullif(trim(p_source), '') is null
    or nullif(trim(p_client_event_id), '') is null
    or nullif(trim(p_idempotency_key), '') is null
    or jsonb_typeof(safe_metadata) <> 'object'
  then
    raise exception 'Inventory event evidence is incomplete' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventory_items item
    where item.restaurant_id = p_restaurant_id
      and item.id = p_inventory_item_id
  ) then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || trim(p_client_event_id),
      0
    )
  );

  select event.*
  into existing_event
  from public.inventory_events event
  where event.restaurant_id = p_restaurant_id
    and (
      event.client_event_id = trim(p_client_event_id)
      or event.idempotency_key = trim(p_idempotency_key)
    )
  order by event.sequence
  limit 1;

  if found then
    if existing_event.inventory_item_id = p_inventory_item_id
      and existing_event.event_type = p_event_type
      and existing_event.quantity = p_quantity
      and existing_event.canonical_unit = p_canonical_unit
      and existing_event.effective_at = p_effective_at
      and existing_event.source = trim(p_source)
      and existing_event.source_reference is not distinct from nullif(trim(p_source_reference), '')
      and existing_event.reason_code is not distinct from nullif(trim(p_reason_code), '')
      and existing_event.client_event_id = trim(p_client_event_id)
      and existing_event.idempotency_key = trim(p_idempotency_key)
      and existing_event.supersedes_event_id is not distinct from p_supersedes_event_id
      and private.inventory_event_client_comparable_metadata(existing_event.metadata)
        = safe_metadata
    then
      return existing_event;
    end if;

    raise exception 'Inventory event idempotency conflict' using errcode = '23505';
  end if;

  if p_supersedes_event_id is not null then
    if p_event_type <> 'correction' then
      raise exception 'Only correction events can supersede history' using errcode = '22023';
    end if;

    select event.*
    into superseded_event
    from public.inventory_events event
    where event.id = p_supersedes_event_id
      and event.restaurant_id = p_restaurant_id
      and event.inventory_item_id = p_inventory_item_id;

    if not found then
      raise exception 'Superseded event not found for inventory item' using errcode = '23503';
    end if;

    if exists (
      select 1
      from public.inventory_events event
      where event.restaurant_id = p_restaurant_id
        and event.supersedes_event_id = p_supersedes_event_id
    ) then
      raise exception 'Inventory event has already been superseded' using errcode = '23505';
    end if;
  end if;

  insert into public.inventory_events (
    restaurant_id,
    inventory_item_id,
    event_type,
    quantity,
    canonical_unit,
    effective_at,
    actor_user_id,
    source,
    source_reference,
    reason_code,
    client_event_id,
    idempotency_key,
    supersedes_event_id,
    metadata
  )
  values (
    p_restaurant_id,
    p_inventory_item_id,
    p_event_type,
    p_quantity,
    p_canonical_unit,
    p_effective_at,
    auth.uid(),
    trim(p_source),
    nullif(trim(p_source_reference), ''),
    nullif(trim(p_reason_code), ''),
    trim(p_client_event_id),
    trim(p_idempotency_key),
    p_supersedes_event_id,
    safe_metadata
  )
  returning * into inserted_event;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    p_restaurant_id,
    auth.uid(),
    'inventory_event.recorded',
    'inventory_events',
    inserted_event.id,
    jsonb_build_object(
      'event_type', inserted_event.event_type,
      'client_event_id', inserted_event.client_event_id,
      'sequence', inserted_event.sequence
    )
  );

  return inserted_event;
end;
$$;

revoke all on function public.record_inventory_event(
  uuid, uuid, text, numeric, text, timestamptz, text, text, text, text, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.record_inventory_event(
  uuid, uuid, text, numeric, text, timestamptz, text, text, text, text, text, uuid, jsonb
) to authenticated;

create or replace function private.capture_inventory_event_activity_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_type text;
  event_category text := 'inventory';
  event_title text;
  event_summary text;
  event_attention boolean := false;
  event_autonomy smallint := 1;
  recent_waste_days integer := 0;
  stockout_prior_canonical text;
  evidence_summary text;
begin
  -- Supplier delivery aggregates already create one order-level activity. Keep
  -- their individual receipt lines out of the operator feed.
  if new.event_type = 'receipt' and new.source = 'supplier_delivery' then
    return new;
  end if;

  if new.event_type = 'waste' then
    select count(distinct (waste_event.effective_at at time zone restaurant.timezone)::date)
    into recent_waste_days
    from public.inventory_events waste_event
    join public.restaurants restaurant
      on restaurant.id = waste_event.restaurant_id
    where waste_event.restaurant_id = new.restaurant_id
      and waste_event.inventory_item_id = new.inventory_item_id
      and waste_event.event_type = 'waste'
      and (waste_event.effective_at at time zone restaurant.timezone)::date
        >= (new.effective_at at time zone restaurant.timezone)::date - 6
      and (waste_event.effective_at at time zone restaurant.timezone)::date
        <= (new.effective_at at time zone restaurant.timezone)::date
      and not exists (
        select 1
        from public.inventory_events correction
        where correction.restaurant_id = waste_event.restaurant_id
          and correction.event_type = 'correction'
          and correction.supersedes_event_id = waste_event.id
      );
    event_type := 'waste_analysis_completed';
    event_category := 'waste';
    event_attention := recent_waste_days >= 2;
    event_autonomy := 2;
    event_title := case
      when event_attention then 'Waste pattern needs review'
      else 'Waste recorded and analyzed'
    end;
    event_summary := format(
      '%s %s was recorded as waste%s.',
      new.quantity,
      new.canonical_unit,
      case
        when event_attention then format(' across %s recent operating days', recent_waste_days)
        else ''
      end
    );
    evidence_summary := format('%s %s via %s', new.quantity, new.canonical_unit, new.source);
  elsif new.event_type = 'stockout' then
    stockout_prior_canonical := nullif(new.metadata->>'canonical_quantity_before', '');
    event_type := 'inventory_risk_detected';
    event_title := 'Stockout recorded';
    event_attention := true;
    event_autonomy := 1;
    if stockout_prior_canonical is not null then
      event_summary := format(
        'Stockout recorded; prior on-hand was %s %s.',
        stockout_prior_canonical,
        new.canonical_unit
      );
      evidence_summary := format(
        'prior %s %s via %s',
        stockout_prior_canonical,
        new.canonical_unit,
        new.source
      );
    else
      event_summary := 'Stockout recorded; prior on-hand was not captured.';
      evidence_summary := format('0 %s via %s', new.canonical_unit, new.source);
    end if;
  else
    event_type := case
      when new.event_type = 'count' then 'inventory_count_recorded'
      when new.event_type = 'receipt' then 'delivery_logged'
      else 'forecast_updated'
    end;
    event_title := case
      when new.event_type = 'count' then 'Inventory count recorded'
      when new.event_type = 'receipt' then 'Delivery quantity recorded'
      else 'Inventory quantity updated'
    end;
    event_summary := format('%s %s inventory event recorded.', new.quantity, new.canonical_unit);
    event_attention := false;
    event_autonomy := case when new.event_type in ('usage', 'adjustment') then 4 else 1 end;
    evidence_summary := format('%s %s via %s', new.quantity, new.canonical_unit, new.source);
  end if;

  perform private.append_activity_event(
    new.restaurant_id,
    event_type,
    event_category,
    event_title,
    event_summary,
    new.effective_at,
    'mise',
    case when new.source like 'mise%' then 'mise' else 'user' end,
    new.actor_user_id,
    new.event_type,
    new.inventory_item_id::text,
    jsonb_build_array(jsonb_build_object(
      'type', 'inventory_event',
      'id', new.id,
      'summary', evidence_summary,
      'observedAt', new.effective_at
    )),
    array['mise', 'inventory', new.source]::text[],
    null,
    null,
    event_autonomy,
    null,
    'completed',
    event_attention,
    null,
    'inventory_item',
    new.inventory_item_id::text,
    coalesce(new.metadata->>'sequenceId', format('inventory-item:%s', new.inventory_item_id)),
    null,
    null,
    format('inventory_event:%s', new.id),
    jsonb_build_object(
      'inventoryItemId', new.inventory_item_id,
      'eventType', new.event_type,
      'quantity', new.quantity,
      'canonicalUnit', new.canonical_unit,
      'sourceReference', new.source_reference,
      'quantityBefore', case
        when new.event_type = 'stockout' then new.metadata->'quantity_before'
        else null
      end,
      'canonicalQuantityBefore', case
        when new.event_type = 'stockout' then new.metadata->'canonical_quantity_before'
        else null
      end,
      'recentWasteDays', case when new.event_type = 'waste' then recent_waste_days else null end
    ),
    null,
    null,
    null
  );
  return new;
end;
$$;

revoke all on function private.inventory_event_client_comparable_metadata(jsonb)
  from public, anon, authenticated;
revoke all on function private.stamp_stockout_inventory_event_quantity_before()
  from public, anon, authenticated;
revoke all on function private.capture_inventory_event_activity_v2()
  from public, anon, authenticated;

comment on function private.inventory_event_client_comparable_metadata(jsonb) is
  'Strips server-owned stockout quantity_before keys so idempotent inventory event replay ignores stamps the client cannot forge.';

comment on function private.stamp_stockout_inventory_event_quantity_before() is
  'Before insert, stamps stockout metadata.quantity_before and canonical_quantity_before from the locked inventory item on-hand, overwriting client values.';

comment on function private.capture_inventory_event_activity_v2() is
  'Maps authoritative inventory events to idempotent operator activity; stockouts include prior on-hand when stamped; repeated waste is explicit and reviewable.';
