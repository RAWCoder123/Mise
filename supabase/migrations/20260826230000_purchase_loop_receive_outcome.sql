-- Mise purchase-loop receive outcome measurement
-- Enrich supplier-delivery action_outcomes with predicted, ordered, and received
-- quantities while leaving later count variance explicitly pending.

-- Purchase-loop receive outcome measurement
-- Links predicted (recommendation), ordered, and received quantities into the
-- existing append-only action_outcomes row written by supplier delivery.

create or replace function private.purchase_loop_receive_outcome_payload(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_delivery_id uuid,
  p_delivery_status text,
  p_has_discrepancy boolean,
  p_has_partial boolean,
  p_line_count integer
)
returns table (
  expected_result jsonb,
  actual_result jsonb,
  variance jsonb,
  lesson text
)
language plpgsql
stable
set search_path = ''
as $fn$
declare
  predicted_total numeric := 0;
  ordered_total numeric := null;
  received_total numeric := 0;
  damaged_total numeric := 0;
  missing_total numeric := 0;
  usable_total numeric := 0;
  recommendation_count integer := 0;
  lines_with_prediction integer := 0;
  lines_with_order integer := 0;
  ordered_versus_predicted numeric := null;
  received_versus_ordered numeric := null;
  usable_versus_predicted numeric := null;
  usable_versus_ordered numeric := null;
  lesson_code text;
  lesson_text text;
  line_rows jsonb := '[]'::jsonb;
  has_discrepancy boolean := coalesce(p_has_discrepancy, false);
  has_partial boolean := coalesce(p_has_partial, false);
begin
  if p_delivery_status not in ('received', 'discrepancy', 'partially_received') then
    raise exception 'Unsupported delivery status for purchase-loop outcome'
      using errcode = '22023';
  end if;

  select
    coalesce(sum(recommendation.recommended_quantity), 0),
    count(*)
  into predicted_total, recommendation_count
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_supplier_order_id
    and recommendation.status in ('ordered', 'approved');

  select
    coalesce(sum(line.received_quantity), 0),
    coalesce(sum(line.damaged_quantity), 0),
    coalesce(sum(line.missing_quantity), 0),
    case
      when count(line.ordered_quantity) = 0 then null
      else sum(line.ordered_quantity)
    end,
    count(*) filter (where line.ordered_quantity is not null),
    jsonb_agg(
      jsonb_build_object(
        'inventoryItemId', line.inventory_item_id,
        'recommendationId', recommendation.id,
        'unit', line.canonical_unit,
        'predictedQuantity', recommendation.recommended_quantity,
        'orderedQuantity', line.ordered_quantity,
        'receivedQuantity', line.received_quantity,
        'damagedQuantity', line.damaged_quantity,
        'missingQuantity', line.missing_quantity,
        'usableReceivedQuantity', line.received_quantity - line.damaged_quantity
      )
      order by line.created_at, line.id
    )
  into
    received_total,
    damaged_total,
    missing_total,
    ordered_total,
    lines_with_order,
    line_rows
  from public.supplier_delivery_items line
  left join lateral (
    select rec.id, rec.recommended_quantity
    from public.purchase_recommendations rec
    where rec.restaurant_id = p_restaurant_id
      and rec.supplier_order_id = p_supplier_order_id
      and rec.inventory_item_id = line.inventory_item_id
      and rec.status in ('ordered', 'approved')
    order by rec.recommended_quantity desc, rec.created_at desc, rec.id desc
    limit 1
  ) recommendation on true
  where line.restaurant_id = p_restaurant_id
    and line.delivery_id = p_delivery_id;

  line_rows := coalesce(line_rows, '[]'::jsonb);
  usable_total := received_total - damaged_total;

  select count(*)
  into lines_with_prediction
  from jsonb_array_elements(line_rows) as entry(value)
  where entry.value ? 'predictedQuantity'
    and nullif(entry.value->>'predictedQuantity', '') is not null;

  if ordered_total is not null then
    ordered_versus_predicted := ordered_total - predicted_total;
    received_versus_ordered := received_total - ordered_total;
    usable_versus_ordered := usable_total - ordered_total;
  end if;
  usable_versus_predicted := usable_total - predicted_total;

  has_discrepancy := has_discrepancy
    or p_delivery_status = 'discrepancy'
    or damaged_total > 0
    or missing_total > 0;
  has_partial := has_partial
    or p_delivery_status = 'partially_received'
    or (
      ordered_total is not null
      and received_total + missing_total < ordered_total
    );

  if has_discrepancy then
    lesson_code := 'purchase_loop.receive.discrepancy';
    lesson_text := 'Delivery recorded damage, missing stock, or another discrepancy against the order.';
  elsif has_partial then
    lesson_code := 'purchase_loop.receive.partial';
    lesson_text := 'Delivery was only partially received relative to the ordered quantity.';
  elsif ordered_total is not null
    and abs(ordered_total - predicted_total) > 0.000001
  then
    lesson_code := 'purchase_loop.receive.prediction_gap';
    lesson_text := 'Ordered quantity differed from the Mise prediction; keep this evidence for learning.';
  elsif ordered_total is not null
    and usable_total + 0.000001 < ordered_total
  then
    lesson_code := 'purchase_loop.receive.quantity_short';
    lesson_text := 'Received quantity was short of the ordered amount; review before trusting fill rates.';
  elsif ordered_total is not null
    and usable_total > ordered_total + 0.000001
  then
    lesson_code := 'purchase_loop.receive.quantity_over';
    lesson_text := 'Received quantity exceeded the ordered amount; confirm before adjusting pars.';
  else
    lesson_code := 'purchase_loop.receive.matched';
    lesson_text := 'Predicted, ordered, and received quantities matched for this supplier order.';
  end if;

  expected_result := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'receive',
    'deliveryStatus', 'received',
    'predictedQuantity', predicted_total,
    'orderedQuantity', coalesce(ordered_total, predicted_total),
    'receivedQuantity', coalesce(ordered_total, predicted_total),
    'usableReceivedQuantity', coalesce(ordered_total, predicted_total)
  );

  actual_result := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'receive',
    'deliveryStatus', p_delivery_status,
    'deliveryId', p_delivery_id,
    'supplierOrderId', p_supplier_order_id,
    'lineCount', greatest(coalesce(p_line_count, 0), jsonb_array_length(line_rows)),
    'recommendationCount', recommendation_count,
    'predictedQuantity', predicted_total,
    'orderedQuantity', ordered_total,
    'receivedQuantity', received_total,
    'damagedQuantity', damaged_total,
    'missingQuantity', missing_total,
    'usableReceivedQuantity', usable_total,
    'countVariancePending', true,
    'lines', line_rows
  );

  variance := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'receive',
    'deliveryStatusMatched', p_delivery_status = 'received',
    'hasDiscrepancy', has_discrepancy,
    'hasPartialReceipt', has_partial,
    'countVariancePending', true,
    'predictedQuantity', predicted_total,
    'orderedQuantity', ordered_total,
    'receivedQuantity', received_total,
    'usableReceivedQuantity', usable_total,
    'orderedVersusPredictedDelta', ordered_versus_predicted,
    'receivedVersusOrderedDelta', received_versus_ordered,
    'usableVersusPredictedDelta', usable_versus_predicted,
    'usableVersusOrderedDelta', usable_versus_ordered,
    'lineCount', jsonb_array_length(line_rows),
    'linesWithPrediction', lines_with_prediction,
    'linesWithOrderQuantity', lines_with_order,
    'lessonCode', lesson_code
  );

  lesson := lesson_text;
  return next;
end;
$fn$;

revoke all on function private.purchase_loop_receive_outcome_payload(
  uuid, uuid, uuid, text, boolean, boolean, integer
) from public, anon, authenticated, service_role;

comment on function private.purchase_loop_receive_outcome_payload(
  uuid, uuid, uuid, text, boolean, boolean, integer
) is
  'Builds receive-phase purchase-loop outcome JSON linking predicted, ordered, and received quantities. Count variance remains pending.';


create or replace function public.record_supplier_delivery_mise_003b_name_base(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_client_delivery_id text,
  p_received_at timestamptz,
  p_lines jsonb,
  p_invoice_total numeric default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders;
  delivery_row public.supplier_deliveries;
  delivery_line jsonb;
  item_row public.inventory_items;
  event_row public.inventory_events;
  action_row public.mise_actions;
  outcome_row public.action_outcomes;
  outcome_payload record;
  memory_row public.restaurant_memories;
  memory_evidence jsonb;
  memory_statement text;
  memory_sample_count integer;
  memory_matched_count integer;
  normalized_status text := 'received';
  ordered_quantity numeric;
  received_quantity numeric;
  damaged_quantity numeric;
  missing_quantity numeric;
  line_canonical_unit text;
  inventory_item_id uuid;
  substitution_item_id uuid;
  unit_price numeric;
  discrepancy_reason text;
  line_number integer := 0;
  line_count integer;
  has_discrepancy boolean := false;
  has_partial boolean := false;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if nullif(trim(p_client_delivery_id), '') is null
    or p_received_at is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) not between 1 and 200
    or pg_column_size(p_lines) > 262144
    or p_invoice_total is not null and (p_invoice_total < 0 or p_invoice_total > 10000000)
    or p_notes is not null and length(p_notes) > 2000
  then
    raise exception 'Delivery evidence is incomplete' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_supplier_order_id
  for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  if order_row.status not in ('sent', 'completed') then
    raise exception 'Only sent orders can be received' using errcode = '22023';
  end if;

  select * into delivery_row
  from public.supplier_deliveries
  where restaurant_id = p_restaurant_id
    and client_delivery_id = left(trim(p_client_delivery_id), 200)
  for update;
  if found then
    if delivery_row.supplier_order_id <> p_supplier_order_id then
      raise exception 'Delivery id belongs to another order' using errcode = '23505';
    end if;
    return jsonb_build_object('outcome', 'already_applied', 'delivery', to_jsonb(delivery_row));
  end if;

  insert into public.supplier_deliveries (
    restaurant_id, supplier_order_id, status, received_at, verified_by,
    invoice_total, notes, client_delivery_id, idempotency_key
  ) values (
    p_restaurant_id, p_supplier_order_id, 'unverified', p_received_at,
    auth.uid(), p_invoice_total, nullif(trim(p_notes), ''),
    left(trim(p_client_delivery_id), 200),
    format('supplier_delivery:%s', left(trim(p_client_delivery_id), 200))
  ) returning * into delivery_row;

  line_count := jsonb_array_length(p_lines);
  for delivery_line in select value from jsonb_array_elements(p_lines)
  loop
    line_number := line_number + 1;
    begin
      inventory_item_id := (delivery_line->>'inventoryItemId')::uuid;
      substitution_item_id := nullif(delivery_line->>'substitutionInventoryItemId', '')::uuid;
      ordered_quantity := nullif(delivery_line->>'orderedQuantity', '')::numeric;
      received_quantity := (delivery_line->>'receivedQuantity')::numeric;
      damaged_quantity := coalesce(nullif(delivery_line->>'damagedQuantity', '')::numeric, 0);
      missing_quantity := coalesce(nullif(delivery_line->>'missingQuantity', '')::numeric, 0);
      line_canonical_unit := delivery_line->>'canonicalUnit';
      unit_price := nullif(delivery_line->>'unitPrice', '')::numeric;
      discrepancy_reason := nullif(left(trim(delivery_line->>'discrepancyReason'), 500), '');
    exception
      when others then
        raise exception 'Delivery line % is invalid', line_number using errcode = '22023';
    end;

    if inventory_item_id is null
      or received_quantity is null or received_quantity < 0 or received_quantity > 1000000
      or ordered_quantity is not null and (ordered_quantity < 0 or ordered_quantity > 1000000)
      or damaged_quantity < 0 or damaged_quantity > received_quantity
      or missing_quantity < 0 or missing_quantity > 1000000
      or line_canonical_unit not in ('g', 'ml', 'each')
      or unit_price is not null and (unit_price < 0 or unit_price > 1000000)
    then
      raise exception 'Delivery line % is outside operational bounds', line_number using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = inventory_item_id;
    if not found then raise exception 'Delivery line item not found' using errcode = 'P0002'; end if;
    if item_row.canonical_unit_verification_status <> 'verified'
      or item_row.canonical_unit <> line_canonical_unit
    then
      raise exception 'Delivery line canonical unit is not verified' using errcode = '22023';
    end if;
    if substitution_item_id is not null and not exists (
      select 1 from public.inventory_items substitution
      where substitution.restaurant_id = p_restaurant_id
        and substitution.id = substitution_item_id
        and substitution.canonical_unit_verification_status = 'verified'
        and substitution.canonical_unit = line_canonical_unit
    ) then
      raise exception 'Delivery substitution is not verified' using errcode = '22023';
    end if;

    has_discrepancy := has_discrepancy
      or damaged_quantity > 0
      or missing_quantity > 0
      or substitution_item_id is not null
      or discrepancy_reason is not null;
    has_partial := has_partial
      or (ordered_quantity is not null and received_quantity + missing_quantity < ordered_quantity);

    if received_quantity - damaged_quantity > 0 then
      select * into event_row
      from public.record_inventory_event(
        p_restaurant_id, coalesce(substitution_item_id, inventory_item_id), 'receipt',
        received_quantity - damaged_quantity, line_canonical_unit,
        p_received_at, 'supplier_delivery',
        format('%s:%s', left(trim(p_client_delivery_id), 200), coalesce(substitution_item_id, inventory_item_id)),
        format('supplier_delivery:%s:%s', left(trim(p_client_delivery_id), 160), coalesce(substitution_item_id, inventory_item_id)),
        delivery_row.id::text, 'supplier_delivery', null,
        jsonb_build_object(
          'supplierOrderId', p_supplier_order_id,
          'deliveryId', delivery_row.id,
          'supplierName', order_row.supplier_name,
          'sequenceId', format('supplier-order:%s', p_supplier_order_id),
          'lineNumber', line_number
        )
      );
    else
      event_row := null;
    end if;

    insert into public.supplier_delivery_items (
      restaurant_id, delivery_id, inventory_item_id, ordered_quantity,
      received_quantity, damaged_quantity, missing_quantity, canonical_unit,
      substitution_inventory_item_id, unit_price, discrepancy_reason,
      inventory_event_id
    ) values (
      p_restaurant_id, delivery_row.id, inventory_item_id, ordered_quantity,
      received_quantity, damaged_quantity, missing_quantity, line_canonical_unit,
      substitution_item_id, unit_price, discrepancy_reason, event_row.id
    );
  end loop;

  normalized_status := case
    when has_discrepancy then 'discrepancy'
    when has_partial then 'partially_received'
    else 'received'
  end;
  update public.supplier_deliveries
  set status = normalized_status, updated_at = now()
  where id = delivery_row.id and restaurant_id = p_restaurant_id
  returning * into delivery_row;

  if normalized_status = 'received' then
    update public.supplier_orders
    set status = 'completed'
    where restaurant_id = p_restaurant_id
      and id = p_supplier_order_id
      and status = 'sent';
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = format('send_supplier_order:%s', p_supplier_order_id);

  if action_row.id is not null then
    select *
      into outcome_payload
    from private.purchase_loop_receive_outcome_payload(
      p_restaurant_id,
      p_supplier_order_id,
      delivery_row.id,
      normalized_status,
      has_discrepancy,
      has_partial,
      line_count
    );

    insert into public.action_outcomes (
      restaurant_id, action_id, expected_result, actual_result, variance,
      measured_at, lesson, idempotency_key
    ) values (
      p_restaurant_id, action_row.id,
      outcome_payload.expected_result,
      outcome_payload.actual_result,
      outcome_payload.variance,
      now(),
      outcome_payload.lesson,
      format('supplier_delivery_outcome:%s', delivery_row.id)
    )
    on conflict (restaurant_id, idempotency_key) do nothing
    returning * into outcome_row;
  end if;

  select * into memory_row
  from public.restaurant_memories memory
  where memory.restaurant_id = p_restaurant_id
    and memory.dedupe_key = format(
      'supplier-delivery-outcome:%s', lower(trim(order_row.supplier_name))
    )
  for update;

  if found and memory_row.status in ('dismissed', 'forgotten', 'disabled') then
    -- Respect the owner's explicit decision. A later delivery must not silently
    -- recreate or re-enable a memory they removed from recommendations.
    memory_row := null;
  else
    memory_evidence := case when memory_row.id is null
      then '[]'::jsonb else memory_row.evidence end;
    memory_evidence := memory_evidence || jsonb_build_array(jsonb_build_object(
      'type', 'supplier_delivery',
      'id', delivery_row.id,
      'supplierOrderId', p_supplier_order_id,
      'status', normalized_status,
      'matched', normalized_status = 'received',
      'summary', case when normalized_status = 'received'
        then format('%s delivery matched the recorded order.', order_row.supplier_name)
        else format('%s delivery was recorded as %s.', order_row.supplier_name, replace(normalized_status, '_', ' '))
      end,
      'observedAt', p_received_at
    ));
    select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
      into memory_evidence
    from jsonb_array_elements(memory_evidence) with ordinality as entry(value, ordinality)
    where entry.ordinality > greatest(jsonb_array_length(memory_evidence) - 20, 0);

    memory_sample_count := jsonb_array_length(memory_evidence);
    select count(*) filter (where entry.value->>'matched' = 'true')
      into memory_matched_count
    from jsonb_array_elements(memory_evidence) as entry(value);
    memory_statement := case
      when memory_matched_count = memory_sample_count then format(
        '%s matched all %s logged deliver%s.', order_row.supplier_name,
        memory_sample_count, case when memory_sample_count = 1 then 'y' else 'ies' end
      )
      else format(
        '%s had discrepancies on %s of %s logged deliver%s.',
        order_row.supplier_name, memory_sample_count - memory_matched_count,
        memory_sample_count, case when memory_sample_count = 1 then 'y' else 'ies' end
      )
    end;

    if memory_row.id is null then
      insert into public.restaurant_memories (
        restaurant_id, memory_type, statement, evidence, confidence,
        first_observed_at, last_updated_at, scope, source,
        affects_recommendations, affects_automation, status, dedupe_key
      ) values (
        p_restaurant_id, 'supplier_reliability', memory_statement,
        memory_evidence, least(0.90, 0.35 + (memory_sample_count - 1) * 0.08),
        p_received_at, p_received_at, 'supplier', 'supplier_delivery_outcomes',
        true, false, 'active', format(
          'supplier-delivery-outcome:%s', lower(trim(order_row.supplier_name))
        )
      ) returning * into memory_row;
    else
      update public.restaurant_memories
      set statement = case when status = 'corrected' then statement else memory_statement end,
        evidence = memory_evidence,
        confidence = least(0.90, 0.35 + (memory_sample_count - 1) * 0.08),
        last_updated_at = p_received_at,
        updated_at = now()
      where restaurant_id = p_restaurant_id and id = memory_row.id
      returning * into memory_row;
    end if;

    perform private.append_activity_event(
      p_restaurant_id, 'restaurant_memory_updated', 'memory',
      'Supplier reliability memory updated',
      left(coalesce(memory_row.correction, memory_row.statement), 1000),
      p_received_at, 'mise', 'system', null,
      'supplier_delivery_outcome', delivery_row.id::text,
      jsonb_build_array(
        jsonb_build_object('type', 'supplier_delivery', 'id', delivery_row.id),
        jsonb_build_object('type', 'action_outcome', 'id', outcome_row.id)
      ),
      array['mise', 'orders', 'memory']::text[], action_row.id, null,
      5::smallint, memory_row.confidence, 'completed', false, null,
      'memory', memory_row.id::text,
      format('supplier-order:%s', p_supplier_order_id),
      action_row.correlation_id, outcome_row.id,
      format('supplier_delivery_memory:%s', delivery_row.id),
      jsonb_build_object(
        'memoryId', memory_row.id,
        'supplierName', order_row.supplier_name,
        'sampleCount', memory_sample_count,
        'matchedCount', memory_matched_count
      ), null, null, memory_row.location_id
    );
  end if;

  perform private.append_activity_event(
    p_restaurant_id,
    case when normalized_status = 'discrepancy' then 'invoice_discrepancy_detected' else 'delivery_logged' end,
    'orders',
    case when normalized_status = 'received' then 'Delivery logged'
      when normalized_status = 'partially_received' then 'Partial delivery logged'
      else 'Delivery discrepancy recorded'
    end,
    format('%s delivery recorded with %s line%s.', order_row.supplier_name, line_count, case when line_count = 1 then '' else 's' end),
    p_received_at, 'mise', 'user', auth.uid(), 'supplier_delivery', delivery_row.id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_order', 'id', p_supplier_order_id),
      jsonb_build_object('type', 'supplier_delivery', 'id', delivery_row.id)
    ),
    array['mise', 'orders', 'inventory']::text[], action_row.id, null, 5::smallint, null,
    case when normalized_status = 'received' then 'confirmed' else 'partially_completed' end,
    normalized_status <> 'received', null, 'supplier_order', p_supplier_order_id::text,
    format('supplier-order:%s', p_supplier_order_id), action_row.correlation_id, null,
    format('supplier_delivery:%s:%s', delivery_row.id, normalized_status),
    jsonb_build_object(
      'deliveryId', delivery_row.id,
      'supplierOrderId', p_supplier_order_id,
      'supplierName', order_row.supplier_name,
      'status', normalized_status,
      'lineCount', line_count,
      'outcomeId', outcome_row.id,
      'memoryId', memory_row.id
    ), null, null, null
  );

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_delivery_recorded',
    'supplier_deliveries', delivery_row.id,
    jsonb_build_object(
      'supplier_order_id', p_supplier_order_id,
      'status', normalized_status,
      'line_count', line_count,
      'has_invoice_total', p_invoice_total is not null
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'delivery', to_jsonb(delivery_row),
    'status', normalized_status,
    'inventoryEventsRecorded', (
      select count(*) from public.supplier_delivery_items item
      where item.restaurant_id = p_restaurant_id
        and item.delivery_id = delivery_row.id
        and item.inventory_event_id is not null
    ),
    'outcomeId', outcome_row.id,
    'memoryId', memory_row.id,
    'actionOutcome', case when outcome_row.id is null then null else to_jsonb(outcome_row) end
  );
end;
$$;

revoke all on function public.record_supplier_delivery_mise_003b_name_base(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;

comment on function public.record_supplier_delivery_mise_003b_name_base(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) is
  'Compatibility base for supplier delivery recording. Action outcomes include purchase-loop predicted/ordered/received measurement; durable supplier memory projection remains in public.record_supplier_delivery.';
