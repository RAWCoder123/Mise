-- Allow active staff to append waste / spoilage events through the ledger RPC.
-- Count, receipt, stockout, adjustment, transfer, correction, and usage remain
-- manager+ (owner/admin/manager). Clients never insert into inventory_events
-- directly; this only relaxes the security-definer gate for p_event_type='waste'.

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_event_type = 'waste' then
    if not private.has_restaurant_role(
      p_restaurant_id,
      array['owner', 'admin', 'manager', 'staff']
    ) then
      raise exception 'Staff or manager access required' using errcode = '42501';
    end if;
  elsif not private.has_restaurant_role(
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
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
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
      and existing_event.metadata = coalesce(p_metadata, '{}'::jsonb)
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
    coalesce(p_metadata, '{}'::jsonb)
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

comment on function public.record_inventory_event(
  uuid, uuid, text, numeric, text, timestamptz, text, text, text, text, text, uuid, jsonb
) is
  'Append-only inventory ledger writer. Waste may be recorded by active staff; all other event types require owner/admin/manager.';
