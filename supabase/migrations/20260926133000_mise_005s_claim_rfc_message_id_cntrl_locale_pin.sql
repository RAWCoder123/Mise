-- MISE-005S: pin claim RFC Message-Id cntrl preflight to COLLATE "C".
--
-- private.service_claim_supplier_email_send still rejects control characters with:
--   p_rfc_message_id ~ '[[:cntrl:]]'
-- Bare POSIX [[:cntrl:]] follows database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005J pinned
-- the supplier_email_deliveries.rfc_message_id CHECK to collate "C", and
-- MISE-005R pinned claim credential identity compare, but left the claim
-- preflight on bare [[:cntrl:]].
--
-- Claim refuses with "Invalid supplier email idempotency material" before any
-- durable write when Message-Id fails the length/cntrl gate. If LC_CTYPE
-- drifted, claim could accept a Message-Id the CHECK would reject (or refuse
-- one the CHECK accepts) — breaking claim→store continuity after restore.
--
-- Scope:
--   - Rewrite private.service_claim_supplier_email_send so the rfc Message-Id
--     preflight uses (p_rfc_message_id collate "C") ~ '[[:cntrl:]]'
--   - Preserve MISE-005R credential↔connection sender identity compare
--     (lower(btrim(...) COLLATE "C") COLLATE "C") so this tip is safe alone
--     or after 005R
-- Does NOT reattach gmail/claimed-envelope/rfc CHECK constraints (MISE-005J/
-- 005O/005P), rewrite build_supplier_send_content (MISE-005Q), or rewrite
-- complete-send provider_message_id preflight (next sibling). Must apply after
-- MISE-003C. Prefer after MISE-005R so both pins land; timestamp after 005R.

create or replace function private.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  credential private.gmail_credentials%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  approved_content jsonb;
  built jsonb;
  content jsonb;
  authority_result jsonb;
  evaluated_at timestamptz;
  decrypted_credential text;
  next_claim_token uuid := gen_random_uuid();
  claimed_ids uuid[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> p_order_id
    or p_rfc_message_id is null
    or pg_catalog.length(p_rfc_message_id) not between 6 and 512
    or p_rfc_message_id collate "C" ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid supplier email idempotency material' using errcode = '22023';
  end if;

  select * into order_snapshot from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;
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

  if delivery.id is not null and delivery.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'externalIdentityChangedDuringClaim', delivery.external_identity_changed_during_claim,
      'orderStatus', order_row.status,
      'supplierId', coalesce(delivery.supplier_id, order_row.supplier_id)
    );
  end if;
  if delivery.id is not null and delivery.status = 'unknown' then
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = coalesce(delivery.last_error_code, 'supplier_email_outcome_unknown'),
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.id is not null and delivery.status = 'sending' then
    if delivery.content_version is null
      or delivery.claimed_recommendation_ids is null
      or delivery.claimed_at < pg_catalog.now() - interval '10 minutes'
    then
      update private.supplier_email_deliveries candidate
      set status = 'unknown',
        last_error_code = case when delivery.content_version is null
          then 'legacy_unproven_claim' else 'stale_send_claim' end,
        updated_at = pg_catalog.now()
      where candidate.id = delivery.id;
      if action_row.id is not null and action_row.status <> 'executed' then
        update public.mise_actions action
        set status = 'unverified',
          error_code = case when delivery.content_version is null
            then 'legacy_unproven_claim' else 'stale_send_claim' end,
          error_message = 'The Gmail delivery result is uncertain and requires review.',
          updated_at = pg_catalog.now()
        where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
      end if;
      return pg_catalog.jsonb_build_object('outcome', 'requires_review');
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'in_progress');
  end if;
  if delivery.id is not null and delivery.idempotency_key <> p_idempotency_key then
    raise exception 'Supplier email idempotency conflict' using errcode = '22023';
  end if;
  if delivery.id is not null and delivery.rfc_message_id <> p_rfc_message_id then
    raise exception 'Supplier email Message-Id changed' using errcode = '22023';
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be emailed' using errcode = '22023';
  end if;

  select * into system_controls from public.system_operational_controls controls
  where controls.singleton for share;
  select * into restaurant_controls from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id for share;
  if system_controls.singleton is null
    or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
    or restaurant_controls.restaurant_id is null
    or not restaurant_controls.gmail_delivery_enabled
  then return pg_catalog.jsonb_build_object('outcome', 'provider_not_enabled'); end if;

  select * into credential from private.gmail_credentials candidate
  where candidate.restaurant_id = p_restaurant_id for update;
  select * into connection from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail'
  for update;
  if credential.id is null or connection.id is null
    or connection.status <> 'connected' or connection.sender_email is null
    or credential.sender_email <> pg_catalog.lower(
      pg_catalog.btrim(connection.sender_email) collate "C"
    ) collate "C"
  then return pg_catalog.jsonb_build_object('outcome', 'gmail_not_connected'); end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id for update;
  select pg_catalog.array_agg(recommendation.id order by recommendation.id)
  into claimed_ids from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';
  if coalesce(pg_catalog.cardinality(claimed_ids), 0) = 0 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('order_lines_missing')
    );
  elsif pg_catalog.cardinality(claimed_ids) > 250 then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_too_large')
    );
  elsif exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
      and recommendation.supplier_id is distinct from order_row.supplier_id
  ) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', pg_catalog.jsonb_build_array('send_content_invalid')
    );
  end if;

  perform 1 from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and exists (
    select 1 from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
      and recommendation.inventory_item_id = item.id
  ) order by item.id for update;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id order by integration.id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id order by location.id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id order by mapping.id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id order by menu_item.id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id order by ingredient.id for share;
  select * into recipient from public.supplier_recipients candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_id = order_row.supplier_id
  for update;
  perform 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id for share;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;
  evaluated_at := pg_catalog.clock_timestamp();
  if recipient.id is null or recipient.email is null then
    return pg_catalog.jsonb_build_object('outcome', 'supplier_email_missing');
  end if;

  if action_row.id is null then
    return pg_catalog.jsonb_build_object('outcome', 'send_content_unapproved');
  end if;
  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status <> 'approved'
    or approved_content is null
    or pg_catalog.jsonb_typeof(approved_content) <> 'object'
    or approved_content->>'version' <> 'mise.supplier_send.v2'
    or approved_content->>'supplierId' <> order_row.supplier_id::text
    or action_row.expected_impact->>'supplierId' <> order_row.supplier_id::text
    or coalesce(approved_content->>'fingerprint', '') !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(approved_content->'contentRevision') is distinct from 'number'
  then return pg_catalog.jsonb_build_object('outcome', 'send_content_unapproved'); end if;

  authority_result := private.evaluate_supplier_send_purchase_authority(
    p_restaurant_id, p_order_id, evaluated_at
  );
  if not coalesce((authority_result->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', case when authority_result->'blockerCodes' ? 'draft_authority_incomplete'
        then 'draft_authority_incomplete' else 'purchase_authority_stale' end,
      'blockerCodes', authority_result->'blockerCodes'
    );
  end if;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return pg_catalog.jsonb_build_object(
      'outcome', 'send_content_unapproved', 'blockerCodes', built->'blockerCodes'
    );
  end if;
  content := built->'content';
  if built->>'contentVersion' is distinct from approved_content->>'version'
    or built->>'contentFingerprint' is distinct from approved_content->>'fingerprint'
    or content->>'supplierId' is distinct from order_row.supplier_id::text
    or content->'contentRevision' is distinct from approved_content->'contentRevision'
  then return pg_catalog.jsonb_build_object('outcome', 'send_content_changed'); end if;

  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    update public.restaurant_email_connections email_connection
    set status = 'needs_reauth', last_verified_at = null, updated_at = pg_catalog.now()
    where email_connection.id = connection.id;
    return pg_catalog.jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  if delivery.id is null then
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, supplier_id, actor_user_id,
      idempotency_key, claim_token, status, rfc_message_id, content_version,
      content_fingerprint, authority_version, authority_fingerprint,
      approved_action_id, claimed_recommendation_ids, claimed_from,
      claimed_to, claimed_subject, credential_generation,
      claimed_content_revision, authority_evaluated_at
    ) values (
      p_restaurant_id, p_order_id, order_row.supplier_id, p_actor_user_id,
      p_idempotency_key, next_claim_token, 'sending', p_rfc_message_id,
      built->>'contentVersion', built->>'contentFingerprint',
      authority_result->>'authorityVersion', authority_result->>'authorityFingerprint',
      action_row.id, claimed_ids, content->>'from', content->>'to', content->>'subject',
      credential.credential_generation, (content->>'contentRevision')::bigint,
      evaluated_at
    ) returning * into delivery;
  else
    update private.supplier_email_deliveries candidate
    set supplier_id = order_row.supplier_id,
      actor_user_id = p_actor_user_id, claim_token = next_claim_token,
      status = 'sending', attempt_count = candidate.attempt_count + 1,
      last_error_code = null, claimed_at = pg_catalog.now(), updated_at = pg_catalog.now(),
      content_version = built->>'contentVersion',
      content_fingerprint = built->>'contentFingerprint',
      authority_version = authority_result->>'authorityVersion',
      authority_fingerprint = authority_result->>'authorityFingerprint',
      approved_action_id = action_row.id, claimed_recommendation_ids = claimed_ids,
      claimed_from = content->>'from', claimed_to = content->>'to',
      claimed_subject = content->>'subject',
      credential_generation = credential.credential_generation,
      claimed_content_revision = (content->>'contentRevision')::bigint,
      authority_evaluated_at = evaluated_at,
      external_identity_changed_during_claim = false
    where candidate.id = delivery.id and candidate.status = 'failed'
    returning * into delivery;
    if not found then
      raise exception 'Supplier email claim is unavailable' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_email_claimed',
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', delivery.supplier_id,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint,
      'line_count', pg_catalog.cardinality(delivery.claimed_recommendation_ids)
    )
  );
  return pg_catalog.jsonb_build_object(
    'outcome', 'claimed', 'claimToken', delivery.claim_token,
    'supplierId', delivery.supplier_id,
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'refreshToken', decrypted_credential,
    'contentVersion', delivery.content_version,
    'contentFingerprint', delivery.content_fingerprint,
    'authorityVersion', delivery.authority_version,
    'authorityFingerprint', delivery.authority_fingerprint,
    'from', delivery.claimed_from, 'to', delivery.claimed_to,
    'subject', delivery.claimed_subject, 'body', content->>'body',
    'rfcMessageId', delivery.rfc_message_id
  );
end;
$$;

revoke all on function private.service_claim_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function private.service_claim_supplier_email_send(
  uuid, uuid, uuid, uuid, text
) to service_role;

comment on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) is
  'MISE-005S: claim supplier email send; RFC Message-Id cntrl preflight and credential identity use COLLATE C.';
