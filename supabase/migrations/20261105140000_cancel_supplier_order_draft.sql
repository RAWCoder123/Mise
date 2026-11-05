-- Managers can abandon an entire draft supplier order after the Orders undo
-- toast expires. Restores every linked approved recommendation to pending
-- through the authoritative undo path (including purchase-decision memory),
-- cancels the send_supplier_order mise action, and removes the empty draft.

create or replace function public.cancel_supplier_order_draft(
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
  recommendation_ids uuid[] := array[]::uuid[];
  recommendation_id uuid;
  undo_result jsonb;
  restored_count integer := 0;
  remaining_approved integer := 0;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_order_id is null then
    raise exception 'Supplier order id is required' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, order_row.supplier_id);

  perform 1
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
  for update;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select * into delivery
  from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id);

  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be cancelled' using errcode = '22023';
  end if;
  if delivery.status = 'sending' then
    raise exception 'send_in_progress' using errcode = '55000';
  end if;
  if delivery.status = 'unknown' then
    raise exception 'delivery_requires_review' using errcode = '55000';
  end if;
  if delivery.id is not null then
    raise exception 'This draft has provider delivery evidence and cannot be cancelled'
      using errcode = '22023';
  end if;
  if action_row.id is not null and action_row.status in ('executing', 'executed', 'unverified') then
    raise exception 'This draft is already in supplier send history and cannot be cancelled'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(recommendation.id order by recommendation.id), array[]::uuid[])
  into recommendation_ids
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
    and recommendation.supplier_id = order_row.supplier_id;

  foreach recommendation_id in array recommendation_ids
  loop
    if exists (
      select 1
      from public.purchase_recommendations pending
      where pending.restaurant_id = p_restaurant_id
        and pending.inventory_item_id = (
          select approved.inventory_item_id
          from public.purchase_recommendations approved
          where approved.restaurant_id = p_restaurant_id
            and approved.id = recommendation_id
        )
        and pending.status = 'pending'
        and pending.id <> recommendation_id
    ) then
      raise exception 'A newer recommendation is already pending' using errcode = '22023';
    end if;
  end loop;

  foreach recommendation_id in array recommendation_ids
  loop
    undo_result := public.undo_purchase_recommendation_action(
      p_restaurant_id,
      recommendation_id
    );
    if undo_result->>'outcome' = 'applied'
      and undo_result->>'previous_status' = 'approved'
    then
      restored_count := restored_count + 1;
    end if;
  end loop;

  select count(*)::integer into remaining_approved
  from public.purchase_recommendations remaining
  where remaining.restaurant_id = p_restaurant_id
    and remaining.supplier_order_id = p_order_id
    and remaining.status = 'approved';
  if remaining_approved > 0 then
    raise exception 'Draft cancel left approved recommendations linked' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id
      and orders.status = 'draft'
  ) then
    delete from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id
      and orders.status = 'draft';
  end if;

  update public.mise_actions action
  set
    status = 'cancelled',
    error_code = null,
    error_message = null,
    updated_at = clock_timestamp()
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = pg_catalog.format('send_supplier_order:%s', p_order_id)
    and action.status in ('prepared', 'waiting_for_approval', 'approved', 'failed', 'rejected');

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    auth.uid(),
    'supplier_order_draft_cancelled',
    'supplier_orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'supplier_id', order_row.supplier_id,
      'supplier_name', order_row.supplier_name,
      'restored_count', restored_count,
      'recommendation_ids', to_jsonb(recommendation_ids)
    )
  );

  return pg_catalog.jsonb_build_object(
    'outcome', 'applied',
    'orderId', p_order_id,
    'supplierId', order_row.supplier_id,
    'supplierName', order_row.supplier_name,
    'restoredCount', restored_count,
    'restoredRecommendationIds', to_jsonb(recommendation_ids)
  );
end;
$$;

revoke all on function public.cancel_supplier_order_draft(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_supplier_order_draft(uuid, uuid)
  to authenticated;

comment on function public.cancel_supplier_order_draft(uuid, uuid) is
  'Owner/admin/manager abandon of a draft supplier order; restores approved lines via undo, cancels send action, deletes empty draft.';
