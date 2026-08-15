-- Bind supplier-email approval to the exact delivery envelope the manager reviewed.
-- The provider claim rechecks the binding while holding the same rows that
-- determine From, To, and Subject, so edits cannot race an approved send.

create or replace function public.approve_supplier_send_envelope(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_order_id uuid,
  p_reviewed_from text,
  p_reviewed_to text,
  p_reviewed_subject text
)
returns public.mise_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions%rowtype;
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  current_from text;
  current_to text;
  current_subject text;
  reviewed_from text := lower(trim(p_reviewed_from));
  reviewed_to text := lower(trim(p_reviewed_to));
  reviewed_subject text := trim(p_reviewed_subject);
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if reviewed_from is null or reviewed_to is null or reviewed_subject is null
    or length(reviewed_from) not between 3 and 254
    or length(reviewed_to) not between 3 and 254
    or length(reviewed_subject) not between 1 and 998
    or reviewed_from ~ '[[:cntrl:]]'
    or reviewed_to ~ '[[:cntrl:]]'
    or reviewed_subject ~ '[[:cntrl:]]'
    or reviewed_from !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or reviewed_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'Supplier send approval requires a valid reviewed envelope' using errcode = '22023';
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.id = p_action_id
    and action.action_type = 'send_supplier_order'
    and (
      action.idempotency_key = format('send_supplier_order:%s', p_order_id)
      or action.expected_impact ->> 'orderId' = p_order_id::text
    )
  for update;
  if not found then
    raise exception 'Supplier send approval required: prepared action not found' using errcode = '22023';
  end if;
  if action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed') then
    raise exception 'Supplier send approval required: action is not approvable' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if not found or order_row.status <> 'draft' then
    raise exception 'Supplier send approval required: order is not a draft' using errcode = '22023';
  end if;

  select * into connection
  from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail'
  for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    raise exception 'Supplier send approval required: Gmail sender is unavailable' using errcode = '22023';
  end if;

  select supplier.* into recipient
  from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name))
    and supplier.email is not null
  order by supplier.created_at, supplier.id
  limit 1
  for update;
  if not found then
    raise exception 'Supplier send approval required: supplier recipient is unavailable' using errcode = '22023';
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
  for share;
  if not found then
    raise exception 'Supplier send approval required: restaurant is unavailable' using errcode = '22023';
  end if;

  current_from := lower(trim(connection.sender_email));
  current_to := lower(trim(recipient.email));
  current_subject := restaurant_name || ' order for ' || order_row.supplier_name;
  if current_from <> reviewed_from
    or current_to <> reviewed_to
    or current_subject <> reviewed_subject
  then
    raise exception 'Supplier send approval required: delivery envelope changed' using errcode = '22023';
  end if;

  if action_row.status <> 'approved' then
    action_row := public.decide_mise_action(p_restaurant_id, p_action_id, 'approved');
  end if;

  update public.mise_actions action
  set approved_by = auth.uid(),
    expected_impact = coalesce(action.expected_impact, '{}'::jsonb) || jsonb_build_object(
      'approvedEnvelope', jsonb_build_object(
        'from', current_from,
        'to', current_to,
        'subject', current_subject,
        'reviewedAt', now()
      )
    ),
    updated_at = now()
  where action.restaurant_id = p_restaurant_id and action.id = p_action_id
  returning * into action_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_send_envelope_approved',
    'mise_actions', p_action_id,
    jsonb_build_object('supplier_order_id', p_order_id)
  );

  return action_row;
end;
$$;

revoke all on function public.approve_supplier_send_envelope(uuid, uuid, uuid, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.approve_supplier_send_envelope(uuid, uuid, uuid, text, text, text)
to authenticated;

-- Preserve the original claim protocol while aligning recipient resolution
-- with the normalized supplier identity used by setup, review UI, and demo.
create or replace function private.service_claim_supplier_email_send_unchecked(
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
  order_row public.supplier_orders%rowtype;
  restaurant_name text;
  recipient_email text;
  connection public.restaurant_email_connections%rowtype;
  credential private.gmail_credentials%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  decrypted_credential text;
  next_claim_token uuid := gen_random_uuid();
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> p_order_id
    or p_rfc_message_id is null or length(p_rfc_message_id) not between 6 and 512
    or p_rfc_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid supplier email idempotency material' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id
  for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  select * into delivery
  from private.supplier_email_deliveries
  where restaurant_id = p_restaurant_id and supplier_order_id = p_order_id
  for update;

  if found and delivery.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'orderStatus', order_row.status
    );
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be emailed' using errcode = '22023';
  end if;
  if found and delivery.status = 'unknown' then
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if found and delivery.status = 'sending' then
    if delivery.claimed_at >= now() - interval '10 minutes' then
      return jsonb_build_object('outcome', 'in_progress');
    end if;
    update private.supplier_email_deliveries
    set status = 'unknown', last_error_code = 'stale_send_claim', updated_at = now()
    where id = delivery.id;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if found and delivery.idempotency_key <> p_idempotency_key then
    raise exception 'Supplier email idempotency conflict' using errcode = '22023';
  end if;

  select * into connection
  from public.restaurant_email_connections
  where restaurant_id = p_restaurant_id and provider = 'gmail'
  for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select * into credential
  from private.gmail_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found or credential.sender_email <> lower(connection.sender_email) then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select recipient.email into recipient_email
  from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and lower(trim(recipient.supplier_name)) = lower(trim(order_row.supplier_name))
    and recipient.email is not null
  order by recipient.created_at, recipient.id
  limit 1;
  if recipient_email is null then
    return jsonb_build_object('outcome', 'supplier_email_missing');
  end if;
  if recipient_email ~ '[[:cntrl:]]'
    or recipient_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(recipient_email) > 254
  then
    return jsonb_build_object('outcome', 'supplier_email_invalid');
  end if;

  select name into restaurant_name from public.restaurants where id = p_restaurant_id;
  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    update public.restaurant_email_connections
    set status = 'needs_reauth', last_verified_at = null, updated_at = now()
    where id = connection.id;
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  if delivery.id is null then
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id
    ) values (
      p_restaurant_id, p_order_id, p_actor_user_id, p_idempotency_key,
      next_claim_token, 'sending', p_rfc_message_id
    ) returning * into delivery;
  else
    update private.supplier_email_deliveries
    set actor_user_id = p_actor_user_id, claim_token = next_claim_token,
      status = 'sending', attempt_count = attempt_count + 1,
      rfc_message_id = p_rfc_message_id, last_error_code = null,
      claimed_at = now(), updated_at = now()
    where id = delivery.id
    returning * into delivery;
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'claimToken', delivery.claim_token,
    'credentialId', credential.id,
    'refreshToken', decrypted_credential,
    'from', credential.sender_email,
    'to', lower(recipient_email),
    'subject', restaurant_name || ' order for ' || order_row.supplier_name,
    'body', order_row.order_message,
    'rfcMessageId', delivery.rfc_message_id
  );
end;
$$;

revoke all on function
  private.service_claim_supplier_email_send_unchecked(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;

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
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  action_row public.mise_actions%rowtype;
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  credential private.gmail_credentials%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  approved_envelope jsonb;
  current_from text;
  current_to text;
  current_subject text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;

  select * into system_controls
  from public.system_operational_controls
  where singleton;
  if not found
    or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into restaurant_controls
  from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id;
  if not found or not restaurant_controls.gmail_delivery_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  if not found then
    return jsonb_build_object('outcome', 'approval_required');
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  -- Executed actions are replay-safe: the unchecked claim returns the durable
  -- already-sent result before enforcing draft-only state.
  if action_row.status = 'executed' then
    return private.service_claim_supplier_email_send_unchecked(
      p_actor_user_id, p_restaurant_id, p_order_id,
      p_idempotency_key, p_rfc_message_id
    );
  end if;
  approved_envelope := action_row.expected_impact -> 'approvedEnvelope';
  if action_row.status <> 'approved'
    or approved_envelope is null
    or jsonb_typeof(approved_envelope) <> 'object'
  then
    return jsonb_build_object('outcome', 'approval_required');
  end if;

  select * into connection
  from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail'
  for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select * into credential
  from private.gmail_credentials gmail_credential
  where gmail_credential.restaurant_id = p_restaurant_id
  for update;
  if not found or credential.sender_email <> lower(connection.sender_email) then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select supplier.* into recipient
  from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name))
    and supplier.email is not null
  order by supplier.created_at, supplier.id
  limit 1
  for update;
  if not found then
    return jsonb_build_object('outcome', 'supplier_email_missing');
  end if;
  if recipient.email ~ '[[:cntrl:]]'
    or recipient.email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(recipient.email) > 254
  then
    return jsonb_build_object('outcome', 'supplier_email_invalid');
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
  for share;
  if not found then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  current_from := lower(trim(credential.sender_email));
  current_to := lower(trim(recipient.email));
  current_subject := restaurant_name || ' order for ' || order_row.supplier_name;
  if lower(trim(approved_envelope ->> 'from')) is distinct from current_from
    or lower(trim(approved_envelope ->> 'to')) is distinct from current_to
    or (approved_envelope ->> 'subject') is distinct from current_subject
  then
    return jsonb_build_object('outcome', 'approval_required');
  end if;

  return private.service_claim_supplier_email_send_unchecked(
    p_actor_user_id, p_restaurant_id, p_order_id,
    p_idempotency_key, p_rfc_message_id
  );
end;
$$;

revoke all on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;
