-- MISE-005X: pin approve_supplier_send_content reviewed fingerprint lower
-- to COLLATE "C".
--
-- public.approve_supplier_send_content still folds the operator-reviewed
-- content fingerprint with:
--   lower(btrim(coalesce(p_reviewed_content_fingerprint, '')))
-- lower() follows database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; MISE-005Q pinned the
-- builder From/To/subject that produce the fingerprint bytes, and
-- MISE-005R/005T pinned claim/complete identity paths, but left the live
-- approve RPC (which replaced revoked approve_supplier_send_envelope) on
-- bare lower/btrim for the reviewed hex fingerprint.
--
-- The reviewed fingerprint is compared to build->>'contentFingerprint' and
-- stored on approvedSendContent. If LC_CTYPE drifted under bare lower,
-- approve could reject a fingerprint the operator reviewed (or accept one
-- the hex shape would later refuse) — breaking supplier-send approval
-- continuity for the same reviewed bytes.
--
-- Scope:
--   - Rewrite public.approve_supplier_send_content so reviewed fingerprint
--     uses: lower(btrim(...) collate "C") collate "C"
--   - Preserve revoke + grant EXECUTE to authenticated only
-- Does NOT rewrite build_supplier_send_content, claim, complete-send, or
-- envelope CHECKs. Must apply after MISE-003C. Compose-safe with
-- MISE-005Q/005R/005T (approve unreplaced since 003c). Prefer after
-- MISE-005Q so builder + approve pins land together; timestamp after 005W.

create or replace function public.approve_supplier_send_content(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_order_id uuid,
  p_reviewed_content_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions%rowtype;
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  built jsonb;
  content jsonb;
  approved_content jsonb;
  reviewed_fingerprint text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_reviewed_content_fingerprint, '')) collate "C"
  ) collate "C";
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if reviewed_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Supplier send content fingerprint is invalid' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);

  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.id = p_action_id
    and action.action_type = 'send_supplier_order'
    and (
      action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
      or action.expected_impact->>'orderId' = p_order_id::text
    )
  for update;
  if not found then
    raise exception 'Supplier send approval required: prepared action not found'
      using errcode = '22023';
  end if;
  if action_row.expected_impact ? 'supplierId'
    and action_row.expected_impact->>'supplierId' <> order_snapshot.supplier_id::text
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_changed',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_changed')
    );
  end if;
  if action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed') then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_unapproved')
    );
  end if;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if found and delivery.status = 'sending' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_in_progress',
      'blockerCodes', pg_catalog.jsonb_build_array('send_in_progress')
    );
  elsif found and delivery.status = 'unknown' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'delivery_requires_review',
      'blockerCodes', pg_catalog.jsonb_build_array('delivery_requires_review')
    );
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  perform 1 from public.restaurant_email_connections connection
  where connection.restaurant_id = p_restaurant_id and connection.provider = 'gmail'
  for update;
  perform 1 from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_id = order_row.supplier_id
  for update;
  perform 1 from public.restaurants restaurant
  where restaurant.id = p_restaurant_id for share;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', built->'blockerCodes'
    );
  end if;
  if built->>'contentFingerprint' is distinct from reviewed_fingerprint then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_changed',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_changed')
    );
  end if;

  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status = 'approved'
    and approved_content->>'version' = built->>'contentVersion'
    and approved_content->>'fingerprint' = reviewed_fingerprint
    and approved_content->>'supplierId' = order_row.supplier_id::text
    and approved_content->'contentRevision' = built->'content'->'contentRevision'
  then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied', 'action', pg_catalog.to_jsonb(action_row),
      'contentVersion', built->>'contentVersion',
      'contentFingerprint', reviewed_fingerprint
    );
  end if;

  if action_row.status <> 'approved' then
    action_row := public.decide_mise_action(p_restaurant_id, p_action_id, 'approved');
  end if;
  content := built->'content';
  update public.mise_actions action
  set approved_by = auth.uid(),
    expected_impact = (
      coalesce(action.expected_impact, '{}'::jsonb)
        - 'approvedEnvelope' - 'approvedSendContent'
    ) || pg_catalog.jsonb_build_object(
      'supplierId', order_row.supplier_id,
      'approvedSendContent', pg_catalog.jsonb_build_object(
        'version', built->>'contentVersion',
        'fingerprint', reviewed_fingerprint,
        'supplierId', order_row.supplier_id,
        'approvedAt', pg_catalog.clock_timestamp(),
        'lineCount', built->'lineCount',
        'contentRevision', (content->>'contentRevision')::bigint,
        'from', content->>'from', 'to', content->>'to',
        'subject', content->>'subject'
      )
    ),
    error_code = null, error_message = null, updated_at = pg_catalog.now()
  where action.restaurant_id = p_restaurant_id and action.id = p_action_id
  returning * into action_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_send_content_approved',
    'mise_actions', p_action_id,
    pg_catalog.jsonb_build_object(
      'supplier_order_id', p_order_id,
      'supplier_id', order_row.supplier_id,
      'content_version', built->>'contentVersion',
      'content_fingerprint', reviewed_fingerprint,
      'line_count', built->'lineCount'
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'applied', 'action', pg_catalog.to_jsonb(action_row),
    'contentVersion', built->>'contentVersion',
    'contentFingerprint', reviewed_fingerprint
  );
end;
$$;

revoke all on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
to authenticated;

comment on function public.approve_supplier_send_content(uuid, uuid, uuid, text) is
  'MISE-005X: approve supplier send content; reviewed fingerprint lower/btrim uses C locale.';
