-- MISE-005IY: pin ingest_purchase_lines document-reference cntrl preflight to COLLATE "C".
--
-- public.ingest_purchase_lines still rejects control characters in
-- p_source_document_reference with bare POSIX [[:cntrl:]], which follows
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; MISE-005F (#414) re-pins the append-only
-- purchase_lines CHECK and purchase_line_text parser the same way, but
-- deliberately left this writer preflight bare so it could compose with
-- open ingest rewrites (MISE-005G octet bound #415 and later stacks).
--
-- The preflight is the first fail-closed gate operators hit before any
-- append_purchase_line work. If LC_CTYPE drifted under bare [[:cntrl:]],
-- the same document-reference bytes could be accepted on one restore and
-- rejected on another — or the reverse — breaking purchase-line ingest
-- continuity across dump/restore even when the CHECK (#414) would agree.
--
-- Scope:
--   - Rewrite public.ingest_purchase_lines so the document-reference
--     control gate uses `document_reference collate "C" ~ '[[:cntrl:]]'`
--   - Preserve exact length/null/authority/idempotency/activity semantics
-- Does NOT reattach purchase_lines text CHECKs (#414), rewrite
-- purchase_line_text (#414), add the octet_length payload bound (#415),
-- or tip purchase-line unit helpers (#666).
-- Timestamp after MISE-005IX (#666). Alone-OK on main. Stacks that later
-- redeclare ingest MUST preserve this COLLATE "C" document-reference gate
-- (same compose rule #415 documents for octet_length).

create or replace function public.ingest_purchase_lines(
  p_restaurant_id uuid,
  p_source text,
  p_source_document_reference text,
  p_lines jsonb,
  p_supplier_id uuid default null,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_reference text;
  correlation uuid;
  entry jsonb;
  line_index integer;
  seen_indexes integer[] := array[]::integer[];
  line_row public.purchase_lines%rowtype;
  submitted integer := 0;
  recorded integer := 0;
  duplicates integer := 0;
  confirmed integer := 0;
  estimated integer := 0;
  unverified integer := 0;
  activity public.activity_events%rowtype;
  requested_confidence text;
  downgrade_flags text[] := array[]::text[];
  downgrade_details jsonb := '[]'::jsonb;
  occurred_at timestamptz := pg_catalog.clock_timestamp();
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_source not in ('invoice', 'order_confirmation', 'manual_entry', 'credit_memo') then
    raise exception 'Unsupported purchase line source' using errcode = '22023';
  end if;

  document_reference := nullif(pg_catalog.btrim(p_source_document_reference), '');
  if document_reference is null
    or pg_catalog.length(document_reference) > 200
    or document_reference collate "C" ~ '[[:cntrl:]]'
  then
    raise exception 'A source document reference is required' using errcode = '22023';
  end if;

  -- Supplier identity is MISE-003C durable identity or nothing. A supplier from
  -- another restaurant fails closed rather than silently becoming unattributed.
  if p_supplier_id is not null
    and not exists (
      select 1 from public.suppliers supplier
      where supplier.restaurant_id = p_restaurant_id
        and supplier.id = p_supplier_id
    )
  then
    raise exception 'Supplier identity is not available for this restaurant'
      using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_lines) <> 'array'
    or pg_catalog.jsonb_array_length(p_lines) not between 1 and 500
  then
    raise exception 'Between 1 and 500 purchase lines are required' using errcode = '22023';
  end if;

  correlation := coalesce(p_correlation_id, pg_catalog.gen_random_uuid());

  for entry in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    submitted := submitted + 1;
    if pg_catalog.jsonb_typeof(entry -> 'lineIndex') <> 'number' then
      raise exception 'Every purchase line needs its document position' using errcode = '22023';
    end if;
    line_index := (entry ->> 'lineIndex')::integer;
    -- Two lines claiming one document position would silently collapse under
    -- the idempotency key, so the whole submission fails instead.
    if line_index = any (seen_indexes) then
      raise exception 'Purchase line position % was submitted twice', line_index
        using errcode = '22023';
    end if;
    seen_indexes := seen_indexes || line_index;

    requested_confidence := private.purchase_line_text(entry, 'parseConfidence', 40);
    line_row := private.append_purchase_line(
      p_restaurant_id, p_supplier_id, p_source, document_reference, correlation,
      entry, line_index, 0, null, true
    );
    if line_row.id is null then
      duplicates := duplicates + 1;
    else
      recorded := recorded + 1;
      confirmed := confirmed + (line_row.parse_confidence = 'confirmed')::integer;
      estimated := estimated + (line_row.parse_confidence = 'estimated')::integer;
      unverified := unverified + (line_row.parse_confidence = 'could_not_verify')::integer;
      -- Only an internal-consistency downgrade is reported here. A line that
      -- lost confidence purely because a field was absent is already counted
      -- in the could-not-verify total on the ingestion record.
      if pg_catalog.cardinality(line_row.consistency_flags) > 0
        and private.purchase_line_confidence_rank(requested_confidence)
            > private.purchase_line_confidence_rank(line_row.parse_confidence)
      then
        downgrade_flags := downgrade_flags || line_row.consistency_flags;
        if pg_catalog.jsonb_array_length(downgrade_details) < 50 then
          downgrade_details := downgrade_details || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'lineIndex', line_index,
              'statedConfidence', requested_confidence,
              'recordedConfidence', line_row.parse_confidence,
              'failedProperties', pg_catalog.to_jsonb(line_row.consistency_flags)
            )
          );
        end if;
      end if;
    end if;
  end loop;

  activity := private.append_activity_event(
    p_restaurant_id,
    'purchase_lines_recorded',
    'orders',
    'Purchase lines recorded',
    pg_catalog.format(
      'Recorded %s of %s lines from %s. %s already on file. %s confirmed, %s estimated, %s could not be verified.',
      recorded, submitted, document_reference, duplicates, confirmed, estimated, unverified
    ),
    occurred_at,
    'mise.purchase_line_ledger',
    'user',
    auth.uid(),
    'purchase_line_ingestion',
    document_reference,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    unverified > 0,
    null::timestamptz,
    'purchase_document',
    document_reference,
    null::text,
    correlation,
    null::uuid,
    'purchase_line_ingestion:' || correlation::text,
    pg_catalog.jsonb_build_object(
      'source', p_source,
      'supplierId', p_supplier_id,
      'submittedLineCount', submitted,
      'recordedLineCount', recorded,
      'duplicateLineCount', duplicates,
      'confirmedCount', confirmed,
      'estimatedCount', estimated,
      'couldNotVerifyCount', unverified
    )
  );

  if pg_catalog.jsonb_array_length(downgrade_details) > 0 then
    perform private.append_purchase_line_downgrade_activity(
      p_restaurant_id, document_reference, correlation, recorded,
      downgrade_flags, downgrade_details, occurred_at
    );
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata, created_at
  ) values (
    p_restaurant_id, auth.uid(), 'purchase_lines_ingested', 'purchase_lines', null,
    pg_catalog.jsonb_build_object(
      'correlation_id', correlation,
      'source', p_source,
      'source_document_reference', document_reference,
      'supplier_id', p_supplier_id,
      'recorded_line_count', recorded,
      'duplicate_line_count', duplicates,
      'could_not_verify_count', unverified,
      'consistency_downgrade_count', pg_catalog.jsonb_array_length(downgrade_details)
    ),
    occurred_at
  );

  return pg_catalog.jsonb_build_object(
    'correlationId', correlation,
    'sourceDocumentReference', document_reference,
    'supplierId', p_supplier_id,
    'submittedLineCount', submitted,
    'recordedLineCount', recorded,
    'duplicateLineCount', duplicates,
    'confirmedCount', confirmed,
    'estimatedCount', estimated,
    'couldNotVerifyCount', unverified,
    'consistencyDowngradeCount', pg_catalog.jsonb_array_length(downgrade_details),
    'activityEventId', activity.id
  );
end;
$$;

revoke all on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid)
to authenticated;

comment on function public.ingest_purchase_lines(uuid, text, text, jsonb, uuid, uuid) is
  'MISE-005IY: purchase-line ingestion. Document-reference control rejection uses COLLATE "C". Records history idempotently on (restaurant, supplier, document, line). Never predicts, orders, or matches items.';
