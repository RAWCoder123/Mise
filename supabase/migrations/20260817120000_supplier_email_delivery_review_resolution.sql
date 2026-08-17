-- Manager-reviewed resolution for ambiguous Gmail supplier-email deliveries.
-- Unknown outcomes stay fail-closed for automatic retry; owners/admins/managers
-- can confirm the email was sent or authorize a deliberate retry after review.

alter table private.supplier_email_deliveries
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid,
  add column if not exists resolution text;

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_resolution_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_resolution_check check (
    resolution is null
    or resolution in ('confirm_sent', 'allow_retry')
  );

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_resolution_consistency_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_resolution_consistency_check check (
    (
      resolution is null
      and resolved_at is null
      and resolved_by_user_id is null
    )
    or (
      resolution is not null
      and resolved_at is not null
      and resolved_by_user_id is not null
    )
  );

comment on column private.supplier_email_deliveries.resolution is
  'Manager review outcome for an ambiguous provider result. Never set by automatic retries.';

-- Clear review markers whenever a failed/unknown delivery is deliberately reclaimed.
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
    set status = 'unknown',
      last_error_code = 'stale_send_claim',
      resolution = null,
      resolved_at = null,
      resolved_by_user_id = null,
      updated_at = now()
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
    set actor_user_id = p_actor_user_id,
      claim_token = next_claim_token,
      status = 'sending',
      attempt_count = attempt_count + 1,
      rfc_message_id = p_rfc_message_id,
      last_error_code = null,
      resolution = null,
      resolved_at = null,
      resolved_by_user_id = null,
      claimed_at = now(),
      updated_at = now()
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
grant execute on function
  private.service_claim_supplier_email_send_unchecked(uuid, uuid, uuid, uuid, text)
to service_role;

create or replace function public.get_supplier_email_delivery_review(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  action_row public.mise_actions%rowtype;
  requires_review boolean := false;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager', 'staff'])
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select * into delivery
  from private.supplier_email_deliveries
  where restaurant_id = p_restaurant_id and supplier_order_id = p_order_id;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id);

  requires_review :=
    (delivery.id is not null and delivery.status = 'unknown')
    or (action_row.id is not null and action_row.status = 'unverified');

  return jsonb_build_object(
    'requiresReview', requires_review,
    'orderStatus', order_row.status,
    'deliveryStatus', case when delivery.id is null then null else delivery.status end,
    'lastErrorCode', delivery.last_error_code,
    'updatedAt', delivery.updated_at,
    'providerMessageIdPresent',
      delivery.provider_message_id is not null and length(delivery.provider_message_id) > 0,
    'resolution', delivery.resolution,
    'actionId', action_row.id,
    'actionStatus', action_row.status
  );
end;
$$;

revoke all on function public.get_supplier_email_delivery_review(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_supplier_email_delivery_review(uuid, uuid)
to authenticated;

create or replace function public.resolve_supplier_email_delivery(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_resolution text,
  p_confirmation text,
  p_provider_message_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  action_row public.mise_actions%rowtype;
  ordered_rows jsonb;
  next_provider_message_id text;
  confirmation text := trim(p_confirmation);
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_resolution not in ('confirm_sent', 'allow_retry') then
    raise exception 'Unsupported supplier email delivery resolution' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select * into delivery
  from private.supplier_email_deliveries
  where restaurant_id = p_restaurant_id and supplier_order_id = p_order_id
  for update;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;

  if delivery.id is not null and delivery.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'resolution', coalesce(delivery.resolution, 'confirm_sent'),
      'order', to_jsonb(order_row),
      'actionStatus', action_row.status
    );
  end if;

  if delivery.id is null or delivery.status <> 'unknown' then
    if action_row.id is null or action_row.status <> 'unverified' then
      raise exception 'Supplier email delivery does not require review' using errcode = '22023';
    end if;
  end if;

  if p_resolution = 'confirm_sent' then
    if confirmation is distinct from 'confirmed_sent_after_review' then
      raise exception 'Supplier email confirm requires explicit confirmation' using errcode = '22023';
    end if;
    if order_row.status <> 'draft' then
      raise exception 'Only draft supplier orders can be confirmed sent' using errcode = '22023';
    end if;

    next_provider_message_id := nullif(trim(p_provider_message_id), '');
    if next_provider_message_id is null then
      next_provider_message_id := 'manager_attested:' || p_order_id::text;
    end if;
    if length(next_provider_message_id) not between 1 and 512
      or next_provider_message_id ~ '[[:cntrl:]]'
    then
      raise exception 'Invalid provider message id' using errcode = '22023';
    end if;

    if delivery.id is null then
      insert into private.supplier_email_deliveries (
        restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
        claim_token, status, rfc_message_id, provider_message_id,
        provider_accepted_at, resolution, resolved_at, resolved_by_user_id,
        last_error_code
      ) values (
        p_restaurant_id, p_order_id, auth.uid(), p_order_id,
        gen_random_uuid(), 'sent',
        'manager-review-' || replace(p_order_id::text, '-', ''),
        next_provider_message_id, now(), 'confirm_sent', now(), auth.uid(),
        null
      )
      returning * into delivery;
    else
      update private.supplier_email_deliveries
      set status = 'sent',
        provider_message_id = next_provider_message_id,
        provider_accepted_at = now(),
        last_error_code = null,
        resolution = 'confirm_sent',
        resolved_at = now(),
        resolved_by_user_id = auth.uid(),
        updated_at = now()
      where id = delivery.id
      returning * into delivery;
    end if;

    update public.supplier_orders
    set status = 'sent',
      email_provider = coalesce(email_provider, 'gmail'),
      provider_message_id = next_provider_message_id,
      sent_at = coalesce(sent_at, now()),
      sent_by_user_id = coalesce(sent_by_user_id, auth.uid())
    where restaurant_id = p_restaurant_id and id = p_order_id
    returning * into order_row;

    update public.purchase_recommendations
    set status = 'ordered'
    where restaurant_id = p_restaurant_id
      and supplier_order_id = p_order_id
      and status = 'approved';

    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions
      set status = 'executed',
        approved_by = coalesce(approved_by, auth.uid()),
        executed_at = coalesce(executed_at, now()),
        result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
          'supplierOrderId', p_order_id,
          'provider', 'gmail',
          'providerMessageId', next_provider_message_id,
          'resolution', 'confirm_sent'
        ),
        error_code = null,
        error_message = null,
        updated_at = now()
      where restaurant_id = p_restaurant_id and id = action_row.id
      returning * into action_row;
    end if;

    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'supplier_email_delivery_confirmed_after_review',
      'supplier_orders', p_order_id,
      jsonb_build_object(
        'provider', 'gmail',
        'resolution', 'confirm_sent',
        'provider_message_id_present', true,
        'manager_attested', next_provider_message_id like 'manager_attested:%'
      )
    );

    select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at), '[]'::jsonb)
    into ordered_rows
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'ordered';

    return jsonb_build_object(
      'outcome', 'applied',
      'resolution', 'confirm_sent',
      'order', to_jsonb(order_row),
      'ordered_recommendations', ordered_rows,
      'actionStatus', action_row.status
    );
  end if;

  -- allow_retry
  if confirmation is distinct from 'authorized_retry_after_review' then
    raise exception 'Supplier email retry requires explicit confirmation' using errcode = '22023';
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can authorize another send' using errcode = '22023';
  end if;

  if delivery.id is not null then
    update private.supplier_email_deliveries
    set status = 'failed',
      last_error_code = 'review_allow_retry',
      resolution = 'allow_retry',
      resolved_at = now(),
      resolved_by_user_id = auth.uid(),
      updated_at = now()
    where id = delivery.id
    returning * into delivery;
  end if;

  if action_row.id is not null then
    update public.mise_actions
    set status = 'failed',
      error_code = 'review_allow_retry',
      error_message = 'Manager authorized another send after reviewing the ambiguous delivery.',
      updated_at = now()
    where restaurant_id = p_restaurant_id and id = action_row.id
    returning * into action_row;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_email_delivery_retry_authorized',
    'supplier_orders', p_order_id,
    jsonb_build_object('provider', 'gmail', 'resolution', 'allow_retry')
  );

  perform private.append_activity_event(
    p_restaurant_id, 'automation_failed', 'orders',
    'Supplier email retry authorized',
    'A manager reviewed the ambiguous Gmail result and authorized another send attempt.',
    now(), 'mise', 'user', auth.uid(),
    'supplier_email_delivery_review', p_order_id::text,
    jsonb_build_array(
      jsonb_build_object('type', 'supplier_order', 'id', p_order_id),
      jsonb_build_object('type', 'mise_action', 'id', action_row.id)
    ),
    array['mise', 'orders', 'gmail']::text[], action_row.id,
    action_row.recommendation_id, action_row.autonomy_level,
    action_row.confidence, 'changed', true, null,
    'supplier_order', p_order_id::text,
    format('supplier-order:%s', p_order_id),
    action_row.correlation_id, null,
    format('supplier_order:%s:allow_retry', p_order_id),
    jsonb_build_object(
      'supplierOrderId', p_order_id,
      'resolution', 'allow_retry'
    ),
    'review_allow_retry',
    'Manager authorized another send after reviewing the ambiguous delivery.',
    action_row.location_id
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'resolution', 'allow_retry',
    'order', to_jsonb(order_row),
    'actionStatus', action_row.status,
    'deliveryStatus', delivery.status
  );
end;
$$;

revoke all on function public.resolve_supplier_email_delivery(uuid, uuid, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.resolve_supplier_email_delivery(uuid, uuid, text, text, text)
to authenticated;

comment on function public.get_supplier_email_delivery_review(uuid, uuid) is
  'Returns bounded supplier-email delivery review state without provider secrets or message bodies.';
comment on function public.resolve_supplier_email_delivery(uuid, uuid, text, text, text) is
  'Manager-reviewed resolution for ambiguous Gmail delivery outcomes before any future resend.';
