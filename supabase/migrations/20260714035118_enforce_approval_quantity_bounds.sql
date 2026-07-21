-- Apply the same strict supplier-order quantity bound on every approval call,
-- including idempotent replays of an already-approved recommendation. The
-- table constraint remains the final authority; this RPC check gives callers a
-- deterministic error before any workflow state is evaluated.

create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  previous_status text;
  workflow_outcome text := 'applied';
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is not null and (
    p_recommended_quantity <= 0
    or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  ) then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('dismissed', 'ordered') then
    raise exception 'Already handled';
  end if;
  if recommendation_row.status = 'approved' then
    workflow_outcome := 'already_applied';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || recommendation_row.supplier_name, 0)
  );

  if recommendation_row.supplier_order_id is not null then
    select * into order_row
    from public.supplier_orders
    where restaurant_id = p_restaurant_id
      and id = recommendation_row.supplier_order_id
    for update;
    if found and order_row.status <> 'draft' then
      raise exception 'Already handled';
    end if;
  end if;

  if order_row.id is null then
    select * into order_row
    from public.supplier_orders
    where restaurant_id = p_restaurant_id
      and supplier_name = recommendation_row.supplier_name
      and status = 'draft'
    order by created_at desc, id desc
    limit 1
    for update;
  end if;

  if order_row.id is null then
    insert into public.supplier_orders (
      restaurant_id,
      supplier_name,
      order_message,
      operator_note,
      status,
      delivery_date
    ) values (
      p_restaurant_id,
      recommendation_row.supplier_name,
      'Order draft for ' || recommendation_row.supplier_name || E'\n\nDelivery requested: Tomorrow morning',
      null,
      'draft',
      current_date + 1
    )
    returning * into order_row;
  end if;

  update public.purchase_recommendations
  set
    status = 'approved',
    recommended_quantity = case
      when previous_status = 'pending' and p_recommended_quantity is not null then p_recommended_quantity
      else recommended_quantity
    end,
    supplier_order_id = order_row.id
  where restaurant_id = p_restaurant_id
    and id = p_recommendation_id
  returning * into recommendation_row;

  update public.supplier_orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id,
    order_row.id,
    order_row.supplier_name,
    order_row.operator_note
  )
  where restaurant_id = p_restaurant_id
    and id = order_row.id
  returning * into order_row;

  if workflow_outcome = 'applied' then
    insert into public.audit_logs (
      restaurant_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_restaurant_id,
      auth.uid(),
      'recommendation_approved',
      'purchase_recommendations',
      recommendation_row.id,
      jsonb_build_object(
        'supplier_name', recommendation_row.supplier_name,
        'urgency', recommendation_row.urgency,
        'supplier_order_id', order_row.id
      )
    );
  end if;

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', to_jsonb(order_row)
  );
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric) from public, anon;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric) to authenticated;
