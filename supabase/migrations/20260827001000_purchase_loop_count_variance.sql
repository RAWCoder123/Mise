-- Mise purchase-loop post-count variance measurement
-- Closes countVariancePending receive evidence by linking counted quantity to
-- system quantity at count start for overlapping purchase-loop items.

create or replace function private.purchase_loop_count_outcome_payload(
  p_restaurant_id uuid,
  p_session_id uuid
)
returns table (
  expected_result jsonb,
  actual_result jsonb,
  variance jsonb,
  lesson text,
  line_count integer
)
language plpgsql
stable
set search_path = ''
as $fn$
declare
  predicted_total numeric := null;
  ordered_total numeric := null;
  received_total numeric := 0;
  usable_total numeric := 0;
  system_total numeric := 0;
  counted_total numeric := 0;
  variance_from_system numeric := 0;
  short_count integer := 0;
  over_count integer := 0;
  matched_count integer := 0;
  lesson_code text;
  lesson_text text;
  line_rows jsonb := '[]'::jsonb;
  linked_receive_ids jsonb := '[]'::jsonb;
begin
  with pending_receive as (
    select
      outcome.id as receive_outcome_id,
      outcome.measured_at,
      outcome.actual_result
    from public.action_outcomes outcome
    where outcome.restaurant_id = p_restaurant_id
      and outcome.actual_result->>'evidenceVersion' = 'mise.purchase_loop_outcome.v1'
      and outcome.actual_result->>'phase' = 'receive'
      and coalesce((outcome.actual_result->>'countVariancePending')::boolean, false) = true
  ),
  pending_lines as (
    select distinct on (line.value->>'inventoryItemId')
      case
        when nullif(btrim(line.value->>'inventoryItemId'), '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then nullif(btrim(line.value->>'inventoryItemId'), '')::uuid
        else null
      end as inventory_item_id,
      nullif(btrim(line.value->>'recommendationId'), '') as recommendation_id,
      coalesce(nullif(btrim(line.value->>'unit'), ''), 'each') as unit,
      case
        when nullif(line.value->>'predictedQuantity', '') is null then null
        else (line.value->>'predictedQuantity')::numeric
      end as predicted_quantity,
      case
        when nullif(line.value->>'orderedQuantity', '') is null then null
        else (line.value->>'orderedQuantity')::numeric
      end as ordered_quantity,
      (line.value->>'receivedQuantity')::numeric as received_quantity,
      (line.value->>'usableReceivedQuantity')::numeric as usable_received_quantity,
      nullif(btrim(pending.actual_result->>'deliveryId'), '') as delivery_id,
      nullif(btrim(pending.actual_result->>'supplierOrderId'), '') as supplier_order_id,
      pending.receive_outcome_id
    from pending_receive pending
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(pending.actual_result->'lines') = 'array'
          then pending.actual_result->'lines'
        else '[]'::jsonb
      end
    ) as line(value)
    where nullif(btrim(line.value->>'inventoryItemId'), '') is not null
      and nullif(line.value->>'receivedQuantity', '') is not null
      and nullif(line.value->>'usableReceivedQuantity', '') is not null
      and (line.value->>'receivedQuantity')::numeric >= 0
      and (line.value->>'usableReceivedQuantity')::numeric >= 0
    order by
      line.value->>'inventoryItemId',
      pending.measured_at desc,
      pending.receive_outcome_id desc
  ),
  counted as (
    select
      count_line.inventory_item_id,
      count_line.unit,
      count_line.system_quantity_at_start,
      count_line.counted_quantity,
      -- Hosted approve writes inventory events before this measurement. Prefer the
      -- frozen count-session system quantity for before/after learning fields; the
      -- authoritative purchase-loop signal remains varianceFromSystem.
      count_line.system_quantity_at_start as quantity_before,
      count_line.counted_quantity as quantity_after,
      prior.recommendation_id,
      prior.unit as prior_unit,
      prior.predicted_quantity,
      prior.ordered_quantity,
      prior.received_quantity,
      prior.usable_received_quantity,
      prior.delivery_id,
      prior.supplier_order_id,
      prior.receive_outcome_id,
      (count_line.counted_quantity - count_line.system_quantity_at_start) as variance_from_system,
      (count_line.counted_quantity - prior.usable_received_quantity) as counted_versus_usable
    from public.inventory_count_lines count_line
    join pending_lines prior
      on prior.inventory_item_id = count_line.inventory_item_id
    where count_line.session_id = p_session_id
      and count_line.restaurant_id = p_restaurant_id
      and count_line.counted_quantity is not null
      and prior.inventory_item_id is not null
  )
  select
    case when count(*) = 0 then null else sum(predicted_quantity) end,
    case when count(*) filter (where ordered_quantity is not null) = 0 then null else sum(ordered_quantity) end,
    coalesce(sum(received_quantity), 0),
    coalesce(sum(usable_received_quantity), 0),
    coalesce(sum(system_quantity_at_start), 0),
    coalesce(sum(counted_quantity), 0),
    coalesce(sum(variance_from_system), 0),
    count(*) filter (where variance_from_system < -0.000001),
    count(*) filter (where variance_from_system > 0.000001),
    count(*) filter (where abs(variance_from_system) <= 0.000001),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'inventoryItemId', inventory_item_id,
          'recommendationId', recommendation_id,
          'unit', coalesce(nullif(btrim(unit), ''), prior_unit, 'each'),
          'predictedQuantity', predicted_quantity,
          'orderedQuantity', ordered_quantity,
          'receivedQuantity', received_quantity,
          'usableReceivedQuantity', usable_received_quantity,
          'systemQuantityAtStart', system_quantity_at_start,
          'countedQuantity', counted_quantity,
          'quantityBefore', quantity_before,
          'quantityAfter', quantity_after,
          'varianceFromSystem', variance_from_system,
          'countedVersusUsableReceivedDelta', counted_versus_usable,
          'deliveryId', delivery_id,
          'supplierOrderId', supplier_order_id,
          'receiveOutcomeId', receive_outcome_id
        )
        order by inventory_item_id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(distinct linked.receive_outcome_id)
        from counted linked
        where linked.receive_outcome_id is not null
      ),
      '[]'::jsonb
    )
  into
    predicted_total,
    ordered_total,
    received_total,
    usable_total,
    system_total,
    counted_total,
    variance_from_system,
    short_count,
    over_count,
    matched_count,
    line_rows,
    linked_receive_ids
  from counted;

  line_rows := coalesce(line_rows, '[]'::jsonb);
  linked_receive_ids := coalesce(linked_receive_ids, '[]'::jsonb);

  if jsonb_array_length(line_rows) < 1 then
    return;
  end if;

  if short_count > 0 and over_count > 0 then
    lesson_code := 'purchase_loop.count.mixed';
    lesson_text := 'Post-receive count showed both short and over variances across purchase-loop items.';
  elsif short_count > 0 then
    lesson_code := 'purchase_loop.count.short';
    lesson_text := 'Post-receive count was short of the system quantity; review waste or depletion before trusting pars.';
  elsif over_count > 0 then
    lesson_code := 'purchase_loop.count.over';
    lesson_text := 'Post-receive count exceeded the system quantity; confirm receiving or conversion before adjusting pars.';
  else
    lesson_code := 'purchase_loop.count.matched';
    lesson_text := 'Post-receive count matched the system quantity for purchase-loop items.';
  end if;

  expected_result := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'count',
    'countSessionId', p_session_id,
    'predictedQuantity', predicted_total,
    'orderedQuantity', ordered_total,
    'receivedQuantity', usable_total,
    'usableReceivedQuantity', usable_total,
    'systemQuantityAtStart', system_total,
    'countedQuantity', system_total
  );

  actual_result := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'count',
    'countSessionId', p_session_id,
    'lineCount', jsonb_array_length(line_rows),
    'predictedQuantity', predicted_total,
    'orderedQuantity', ordered_total,
    'receivedQuantity', received_total,
    'usableReceivedQuantity', usable_total,
    'systemQuantityAtStart', system_total,
    'countedQuantity', counted_total,
    'countVariancePending', false,
    'linkedReceiveOutcomeIds', linked_receive_ids,
    'lines', line_rows
  );

  variance := jsonb_build_object(
    'evidenceVersion', 'mise.purchase_loop_outcome.v1',
    'phase', 'count',
    'countSessionId', p_session_id,
    'countVariancePending', false,
    'predictedQuantity', predicted_total,
    'orderedQuantity', ordered_total,
    'receivedQuantity', received_total,
    'usableReceivedQuantity', usable_total,
    'systemQuantityAtStart', system_total,
    'countedQuantity', counted_total,
    'varianceFromSystem', variance_from_system,
    'countedVersusUsableReceivedDelta', counted_total - usable_total,
    'shortCount', short_count,
    'overCount', over_count,
    'matchedCount', matched_count,
    'lineCount', jsonb_array_length(line_rows),
    'lessonCode', lesson_code
  );

  lesson := lesson_text;
  line_count := jsonb_array_length(line_rows);
  return next;
end;
$fn$;

revoke all on function private.purchase_loop_count_outcome_payload(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function private.purchase_loop_count_outcome_payload(uuid, uuid) is
  'Builds count-phase purchase-loop outcome JSON linking predicted/ordered/received evidence to post-receive count variance.';

create or replace function private.record_purchase_loop_count_outcome(
  p_restaurant_id uuid,
  p_session_id uuid,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  outcome_payload record;
  action_row public.mise_actions%rowtype;
  outcome_row public.action_outcomes%rowtype;
  action_key text := format('purchase_loop_count_outcome:%s', p_session_id);
  outcome_key text := format('purchase_loop_count_outcome:%s', p_session_id);
begin
  select *
    into outcome_payload
  from private.purchase_loop_count_outcome_payload(p_restaurant_id, p_session_id);

  if outcome_payload.line_count is null or outcome_payload.line_count < 1 then
    return null;
  end if;

  insert into public.mise_actions (
    restaurant_id,
    action_type,
    execution_mode,
    status,
    autonomy_level,
    trigger_type,
    trigger_reference,
    reason,
    evidence,
    requested_by,
    approved_by,
    executed_at,
    result,
    idempotency_key,
    expected_impact,
    created_at,
    updated_at
  ) values (
    p_restaurant_id,
    'measure_outcome',
    'observe',
    'executed',
    5,
    'inventory_count_session_approved',
    p_session_id::text,
    'Measure post-receive purchase-loop count variance for learning.',
    jsonb_build_array(jsonb_build_object(
      'type', 'inventory_count_session',
      'id', p_session_id
    )),
    p_actor_user_id,
    p_actor_user_id,
    clock_timestamp(),
    jsonb_build_object(
      'countSessionId', p_session_id,
      'lineCount', outcome_payload.line_count,
      'phase', 'count'
    ),
    action_key,
    jsonb_build_object(
      'countSessionId', p_session_id,
      'phase', 'count',
      'evidenceVersion', 'mise.purchase_loop_outcome.v1'
    ),
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (restaurant_id, idempotency_key) do update
  set updated_at = excluded.updated_at
  returning * into action_row;

  insert into public.action_outcomes (
    restaurant_id,
    action_id,
    expected_result,
    actual_result,
    variance,
    measured_at,
    lesson,
    idempotency_key
  ) values (
    p_restaurant_id,
    action_row.id,
    outcome_payload.expected_result,
    outcome_payload.actual_result,
    outcome_payload.variance,
    clock_timestamp(),
    outcome_payload.lesson,
    outcome_key
  )
  on conflict (restaurant_id, idempotency_key) do nothing
  returning * into outcome_row;

  if outcome_row.id is null then
    select *
      into outcome_row
    from public.action_outcomes
    where restaurant_id = p_restaurant_id
      and idempotency_key = outcome_key;
  end if;

  return outcome_row.id;
end;
$fn$;

revoke all on function private.record_purchase_loop_count_outcome(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function private.record_purchase_loop_count_outcome(uuid, uuid, uuid) is
  'Appends an observe measure_outcome action and count-phase purchase-loop action_outcome after count approval.';

create or replace function private.service_approve_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_session_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  session_row public.inventory_count_sessions%rowtype;
  line_row public.inventory_count_lines%rowtype;
  item_row public.inventory_items%rowtype;
  quantity_before numeric;
  quantity_after numeric;
  changed_count integer := 0;
  line_count integer := 0;
  event_metadata jsonb;
  safe_note text;
  stable_event_key text;
  purchase_loop_outcome_id uuid;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  select * into session_row
  from public.inventory_count_sessions
  where id = p_session_id and restaurant_id = p_restaurant_id
  for update;
  if not found then raise exception 'Count session not found'; end if;
  if session_row.status <> 'submitted' then
    raise exception 'Submit the count session before approving adjustments' using errcode = '22023';
  end if;

  for line_row in
    select *
    from public.inventory_count_lines
    where session_id = p_session_id
    order by item_name, id
    for update
  loop
    line_count := line_count + 1;
    if line_row.counted_quantity is null then
      raise exception 'Count every item before approving the session' using errcode = '22023';
    end if;

    select * into item_row
    from public.inventory_items
    where restaurant_id = p_restaurant_id and id = line_row.inventory_item_id
    for update;
    if not found then
      raise exception 'Count line references an inventory item that is no longer available';
    end if;

    if item_row.canonical_unit_verification_status <> 'verified'
      or item_row.canonical_unit is null
      or item_row.canonical_quantity_per_unit is null
      or item_row.canonical_quantity_per_unit <= 0
    then
      raise exception 'Inventory item canonical conversion is not verified' using errcode = '22023';
    end if;

    quantity_before := item_row.current_quantity;
    quantity_after := line_row.counted_quantity;
    if quantity_after is distinct from quantity_before then
      stable_event_key := 'count_session:' || p_session_id::text || ':' || line_row.inventory_item_id::text;
      event_metadata := jsonb_build_object(
        'session_id', p_session_id,
        'system_quantity_at_start', line_row.system_quantity_at_start,
        'variance_from_system', quantity_after - line_row.system_quantity_at_start
      );
      safe_note := nullif(btrim(coalesce(line_row.note, '')), '');
      if safe_note is not null then
        event_metadata := event_metadata || jsonb_build_object('note', safe_note);
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
        client_event_id,
        idempotency_key,
        metadata
      ) values (
        p_restaurant_id,
        line_row.inventory_item_id,
        'count',
        quantity_after * item_row.canonical_quantity_per_unit,
        item_row.canonical_unit,
        clock_timestamp(),
        p_actor_user_id,
        'approve_count_session',
        stable_event_key,
        stable_event_key,
        event_metadata
      );
      changed_count := changed_count + 1;
    end if;
  end loop;

  if line_count < 1 then
    raise exception 'Count session has no lines to approve' using errcode = '22023';
  end if;

  update public.inventory_count_sessions
  set status = 'approved',
      approved_by = p_actor_user_id,
      approved_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = p_session_id;

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  purchase_loop_outcome_id := private.record_purchase_loop_count_outcome(
    p_restaurant_id,
    p_session_id,
    p_actor_user_id
  );

  return private.inventory_count_session_detail(p_session_id)
    || jsonb_build_object(
      'lines_changed', changed_count,
      'lines_total', line_count,
      'purchase_loop_count_outcome_id', purchase_loop_outcome_id
    );
end;
$$;

comment on function private.service_approve_inventory_count_session(uuid, uuid, uuid, bigint, jsonb, jsonb) is
  'Approves a submitted inventory count session, commits planning signals, and records purchase-loop count variance when pending receive evidence overlaps.';
