-- Promote authoritative waste ledger events into explicit waste analysis
-- activity without changing the append-only inventory event itself.

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
  else
    event_type := case
      when new.event_type = 'count' then 'inventory_count_recorded'
      when new.event_type = 'receipt' then 'delivery_logged'
      when new.event_type = 'stockout' then 'inventory_risk_detected'
      else 'forecast_updated'
    end;
    event_title := case
      when new.event_type = 'count' then 'Inventory count recorded'
      when new.event_type = 'receipt' then 'Delivery quantity recorded'
      when new.event_type = 'stockout' then 'Stockout recorded'
      else 'Inventory quantity updated'
    end;
    event_summary := format('%s %s inventory event recorded.', new.quantity, new.canonical_unit);
    event_attention := new.event_type = 'stockout';
    event_autonomy := case when new.event_type in ('usage', 'adjustment') then 4 else 1 end;
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
      'summary', format('%s %s via %s', new.quantity, new.canonical_unit, new.source),
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
      'recentWasteDays', case when new.event_type = 'waste' then recent_waste_days else null end
    ),
    null,
    null,
    null
  );
  return new;
end;
$$;

drop trigger if exists capture_inventory_event_activity on public.inventory_events;
create trigger capture_inventory_event_activity
after insert on public.inventory_events
for each row execute function private.capture_inventory_event_activity_v2();

revoke all on function private.capture_inventory_event_activity_v2() from public, anon, authenticated;

comment on function private.capture_inventory_event_activity_v2() is
  'Maps authoritative inventory events to idempotent operator activity; repeated waste is explicit and reviewable.';
