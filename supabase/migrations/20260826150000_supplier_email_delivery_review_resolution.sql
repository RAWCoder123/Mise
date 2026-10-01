-- Manager-reviewed resolution for ambiguous Gmail supplier-email deliveries.
-- Unknown outcomes stay fail-closed for automatic retry; owners/admins/managers
-- can confirm the email was sent or authorize a deliberate retry after review.
-- Adapted for MISE-003B/003C claim metadata and durable supplier identity.

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

-- Clear review markers whenever a failed delivery is deliberately reclaimed for send.
create or replace function private.clear_supplier_email_delivery_resolution_on_reclaim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'failed'
    and new.status = 'sending'
    and (
      old.resolution is not null
      or old.resolved_at is not null
      or old.resolved_by_user_id is not null
    )
  then
    new.resolution := null;
    new.resolved_at := null;
    new.resolved_by_user_id := null;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_supplier_email_delivery_resolution_on_reclaim()
from public, anon, authenticated, service_role;

drop trigger if exists clear_supplier_email_delivery_resolution_on_reclaim
  on private.supplier_email_deliveries;
create trigger clear_supplier_email_delivery_resolution_on_reclaim
before update of status on private.supplier_email_deliveries
for each row
execute function private.clear_supplier_email_delivery_resolution_on_reclaim();

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
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select * into delivery
  from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id);

  requires_review :=
    (delivery.id is not null and delivery.status = 'unknown')
    or (action_row.id is not null and action_row.status = 'unverified');

  return pg_catalog.jsonb_build_object(
    'requiresReview', requires_review,
    'orderStatus', order_row.status,
    'deliveryStatus', case when delivery.id is null then null else delivery.status end,
    'lastErrorCode', delivery.last_error_code,
    'updatedAt', delivery.updated_at,
    'providerMessageIdPresent',
      delivery.provider_message_id is not null
      and pg_catalog.length(delivery.provider_message_id) > 0,
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
  order_snapshot public.supplier_orders%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  action_row public.mise_actions%rowtype;
  ordered_rows jsonb;
  next_provider_message_id text;
  confirmation text := pg_catalog.btrim(coalesce(p_confirmation, ''));
  target_ids uuid[];
  changed_count integer;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager'])
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_resolution not in ('confirm_sent', 'allow_retry') then
    raise exception 'Unsupported supplier email delivery resolution' using errcode = '22023';
  end if;

  select * into order_snapshot
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;
  perform private.lock_supplier_authority(p_restaurant_id, order_snapshot.supplier_id);

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if order_row.supplier_id is distinct from order_snapshot.supplier_id then
    raise exception 'Supplier order identity changed concurrently; retry' using errcode = '40001';
  end if;

  select * into delivery
  from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;

  if delivery.id is not null and delivery.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'outcome', 'already_applied',
      'resolution', coalesce(delivery.resolution, 'confirm_sent'),
      'order', pg_catalog.to_jsonb(order_row),
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

    next_provider_message_id := nullif(pg_catalog.btrim(coalesce(p_provider_message_id, '')), '');
    if next_provider_message_id is null then
      next_provider_message_id := 'manager_attested:' || p_order_id::text;
    end if;
    if pg_catalog.length(next_provider_message_id) not between 1 and 512
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
        next_provider_message_id, pg_catalog.now(), 'confirm_sent',
        pg_catalog.now(), auth.uid(), null
      )
      returning * into delivery;
    else
      update private.supplier_email_deliveries candidate
      set status = 'sent',
        provider_message_id = next_provider_message_id,
        provider_accepted_at = pg_catalog.now(),
        last_error_code = null,
        resolution = 'confirm_sent',
        resolved_at = pg_catalog.now(),
        resolved_by_user_id = auth.uid(),
        updated_at = pg_catalog.now()
      where candidate.id = delivery.id
      returning * into delivery;
    end if;

    update public.supplier_orders orders
    set status = 'sent',
      email_provider = coalesce(orders.email_provider, 'gmail'),
      provider_message_id = next_provider_message_id,
      sent_at = coalesce(orders.sent_at, pg_catalog.now()),
      sent_by_user_id = coalesce(orders.sent_by_user_id, auth.uid())
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id
      and orders.status = 'draft'
    returning * into order_row;
    if not found then
      raise exception 'Supplier order is not sendable' using errcode = '22023';
    end if;

    if delivery.claimed_recommendation_ids is not null then
      target_ids := delivery.claimed_recommendation_ids;
      update public.purchase_recommendations recommendation
      set status = 'ordered'
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.id = any(target_ids)
        and recommendation.supplier_order_id = p_order_id
        and recommendation.supplier_id = order_row.supplier_id
        and recommendation.status = 'approved';
      get diagnostics changed_count = row_count;
      if changed_count <> pg_catalog.cardinality(target_ids) then
        raise exception 'Supplier email claimed line completion was incomplete'
          using errcode = '22023';
      end if;
    else
      update public.purchase_recommendations recommendation
      set status = 'ordered'
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.supplier_order_id = p_order_id
        and recommendation.supplier_id = order_row.supplier_id
        and recommendation.status = 'approved';
      get diagnostics changed_count = row_count;
      if changed_count < 1 then
        raise exception 'Supplier email claimed line completion was incomplete'
          using errcode = '22023';
      end if;
    end if;

    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'executed',
        approved_by = coalesce(action.approved_by, auth.uid()),
        executed_at = coalesce(action.executed_at, pg_catalog.now()),
        result = coalesce(action.result, '{}'::jsonb) || pg_catalog.jsonb_build_object(
          'supplierOrderId', p_order_id,
          'provider', 'gmail',
          'providerMessageId', next_provider_message_id,
          'resolution', 'confirm_sent'
        ),
        error_code = null,
        error_message = null,
        updated_at = pg_catalog.now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id
      returning * into action_row;
    end if;

    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, auth.uid(), 'supplier_email_delivery_confirmed_after_review',
      'supplier_orders', p_order_id,
      pg_catalog.jsonb_build_object(
        'provider', 'gmail',
        'resolution', 'confirm_sent',
        'provider_message_id_present', true,
        'manager_attested', next_provider_message_id like 'manager_attested:%',
        'supplier_id', coalesce(delivery.supplier_id, order_row.supplier_id),
        'ordered_recommendation_count', changed_count
      )
    );

    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(recommendation) order by recommendation.id
    ), '[]'::jsonb)
    into ordered_rows
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'ordered'
      and (
        delivery.claimed_recommendation_ids is null
        or recommendation.id = any(delivery.claimed_recommendation_ids)
      );

    return pg_catalog.jsonb_build_object(
      'outcome', 'applied',
      'resolution', 'confirm_sent',
      'order', pg_catalog.to_jsonb(order_row),
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
    update private.supplier_email_deliveries candidate
    set status = 'failed',
      last_error_code = 'review_allow_retry',
      resolution = 'allow_retry',
      resolved_at = pg_catalog.now(),
      resolved_by_user_id = auth.uid(),
      updated_at = pg_catalog.now()
    where candidate.id = delivery.id
    returning * into delivery;
  end if;

  if action_row.id is not null then
    update public.mise_actions action
    set status = 'failed',
      error_code = 'review_allow_retry',
      error_message = 'Manager authorized another send after reviewing the ambiguous delivery.',
      updated_at = pg_catalog.now()
    where action.restaurant_id = p_restaurant_id and action.id = action_row.id
    returning * into action_row;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_email_delivery_retry_authorized',
    'supplier_orders', p_order_id,
    pg_catalog.jsonb_build_object(
      'provider', 'gmail',
      'resolution', 'allow_retry',
      'supplier_id', coalesce(delivery.supplier_id, order_row.supplier_id)
    )
  );

  perform private.append_activity_event(
    p_restaurant_id, 'automation_failed', 'orders',
    'Supplier email retry authorized',
    'A manager reviewed the ambiguous Gmail result and authorized another send attempt.',
    pg_catalog.now(), 'mise', 'user', auth.uid(),
    'supplier_email_delivery_review', p_order_id::text,
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('type', 'supplier_order', 'id', p_order_id),
      pg_catalog.jsonb_build_object('type', 'mise_action', 'id', action_row.id)
    ),
    array['mise', 'orders', 'gmail']::text[], action_row.id,
    action_row.recommendation_id, action_row.autonomy_level,
    action_row.confidence, 'changed', true, null,
    'supplier_order', p_order_id::text,
    pg_catalog.format('supplier-order:%s', p_order_id),
    action_row.correlation_id, null,
    pg_catalog.format('supplier_order:%s:allow_retry', p_order_id),
    pg_catalog.jsonb_build_object(
      'supplierOrderId', p_order_id,
      'resolution', 'allow_retry'
    ),
    'review_allow_retry',
    'Manager authorized another send after reviewing the ambiguous delivery.',
    action_row.location_id
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'resolution', 'allow_retry',
    'order', pg_catalog.to_jsonb(order_row),
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
