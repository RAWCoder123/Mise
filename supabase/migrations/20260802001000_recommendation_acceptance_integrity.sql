-- Preserve Mise's original recommended quantity when operators edit on approve,
-- and optionally capture a bounded dismiss reason. Learning continues to use the
-- accepted recommended_quantity; original_recommended_quantity is the audit trail.

alter table public.purchase_recommendations
  add column if not exists original_recommended_quantity numeric null;

alter table public.purchase_recommendations
  add column if not exists dismiss_reason text null;

do $$
begin
  alter table public.purchase_recommendations
    add constraint purchase_recommendations_original_quantity_check
    check (
      original_recommended_quantity is null
      or (
        original_recommended_quantity > 0
        and original_recommended_quantity <= 1000000
        and original_recommended_quantity::text not in ('NaN', 'Infinity', '-Infinity')
      )
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.purchase_recommendations
    add constraint purchase_recommendations_dismiss_reason_length_check
    check (dismiss_reason is null or char_length(dismiss_reason) <= 240);
exception
  when duplicate_object then null;
end $$;

comment on column public.purchase_recommendations.original_recommended_quantity is
  'Quantity Mise recommended at first approval; accepted quantity stays in recommended_quantity.';
comment on column public.purchase_recommendations.dismiss_reason is
  'Optional operator reason when a pending recommendation is dismissed (max 240 chars).';

create or replace function private.service_approve_purchase_recommendation(
  p_actor_user_id uuid,
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
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
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
    original_recommended_quantity = case
      when previous_status = 'pending' then recommendation_row.recommended_quantity
      else original_recommended_quantity
    end,
    recommended_quantity = case
      when previous_status = 'pending' and p_recommended_quantity is not null then p_recommended_quantity
      else recommended_quantity
    end,
    dismiss_reason = case
      when previous_status = 'pending' then null
      else dismiss_reason
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

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', to_jsonb(order_row)
  );
end;
$$;

revoke all on function private.service_approve_purchase_recommendation(uuid, uuid, uuid, numeric)
  from public, anon, authenticated;
grant execute on function private.service_approve_purchase_recommendation(uuid, uuid, uuid, numeric)
  to service_role;

create or replace function public.service_approve_purchase_recommendation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_approve_purchase_recommendation(
    p_actor_user_id,
    p_restaurant_id,
    p_recommendation_id,
    p_recommended_quantity
  );
$$;

revoke all on function public.service_approve_purchase_recommendation(uuid, uuid, uuid, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.service_approve_purchase_recommendation(uuid, uuid, uuid, numeric)
  to service_role;

comment on function public.service_approve_purchase_recommendation(uuid, uuid, uuid, numeric) is
  'Service-owned recommendation approval. Captures original_recommended_quantity on first approve; accepted quantity may replace recommended_quantity.';

drop function if exists public.service_dismiss_purchase_recommendation(uuid, uuid, uuid);
drop function if exists private.service_dismiss_purchase_recommendation(uuid, uuid, uuid);

create or replace function private.service_dismiss_purchase_recommendation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_dismiss_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  previous_status text;
  workflow_outcome text := 'applied';
  safe_dismiss_reason text := nullif(btrim(coalesce(p_dismiss_reason, '')), '');
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if safe_dismiss_reason is not null and char_length(safe_dismiss_reason) > 240 then
    raise exception 'Dismiss reason is outside supported limits' using errcode = '22023';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status in ('approved', 'ordered') then
    raise exception 'Already handled';
  end if;
  if recommendation_row.status = 'dismissed' then
    workflow_outcome := 'already_applied';
  else
    update public.purchase_recommendations
    set
      status = 'dismissed',
      supplier_order_id = null,
      dismiss_reason = safe_dismiss_reason
    where restaurant_id = p_restaurant_id
      and id = p_recommendation_id
    returning * into recommendation_row;
  end if;

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', null
  );
end;
$$;

revoke all on function private.service_dismiss_purchase_recommendation(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.service_dismiss_purchase_recommendation(uuid, uuid, uuid, text)
  to service_role;

create or replace function public.service_dismiss_purchase_recommendation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_dismiss_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_dismiss_purchase_recommendation(
    p_actor_user_id,
    p_restaurant_id,
    p_recommendation_id,
    p_dismiss_reason
  );
$$;

revoke all on function public.service_dismiss_purchase_recommendation(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_dismiss_purchase_recommendation(uuid, uuid, uuid, text)
  to service_role;

comment on function public.service_dismiss_purchase_recommendation(uuid, uuid, uuid, text) is
  'Service-owned recommendation dismissal with optional bounded dismiss_reason.';

create or replace function private.service_undo_purchase_recommendation_action(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_recommendation_id uuid
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
  remaining_count integer := 0;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found'; end if;

  previous_status := recommendation_row.status;
  if recommendation_row.status = 'ordered' then
    raise exception 'This recommendation is already in supplier history and cannot be undone';
  end if;
  if recommendation_row.status = 'pending' then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', null
    );
  end if;
  if exists (
    select 1
    from public.purchase_recommendations pending
    where pending.restaurant_id = p_restaurant_id
      and pending.inventory_item_id = recommendation_row.inventory_item_id
      and pending.status = 'pending'
      and pending.id <> recommendation_row.id
  ) then
    raise exception 'A newer recommendation is already pending';
  end if;

  if previous_status = 'approved' then
    perform pg_advisory_xact_lock(
      hashtextextended(p_restaurant_id::text || E'\x1f' || recommendation_row.supplier_name, 0)
    );
    if recommendation_row.supplier_order_id is not null then
      select * into order_row
      from public.supplier_orders
      where restaurant_id = p_restaurant_id
        and id = recommendation_row.supplier_order_id
      for update;
    end if;
    if order_row.id is not null and order_row.status <> 'draft' then
      raise exception 'This recommendation is already in supplier history and cannot be undone';
    end if;
  end if;

  update public.purchase_recommendations
  set
    status = 'pending',
    supplier_order_id = null,
    recommended_quantity = case
      when previous_status = 'approved'
        and recommendation_row.original_recommended_quantity is not null
      then recommendation_row.original_recommended_quantity
      else recommendation_row.recommended_quantity
    end,
    original_recommended_quantity = case
      when previous_status = 'approved' then null
      else recommendation_row.original_recommended_quantity
    end,
    dismiss_reason = case
      when previous_status = 'dismissed' then null
      else recommendation_row.dismiss_reason
    end
  where restaurant_id = p_restaurant_id
    and id = p_recommendation_id
  returning * into recommendation_row;

  if previous_status = 'approved' and order_row.id is not null then
    select count(*) into remaining_count
    from public.purchase_recommendations remaining
    where remaining.restaurant_id = p_restaurant_id
      and remaining.supplier_order_id = order_row.id
      and remaining.status = 'approved';

    if remaining_count = 0 then
      delete from public.supplier_orders
      where restaurant_id = p_restaurant_id
        and id = order_row.id
        and status = 'draft';
    else
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
    end if;
  end if;

  return jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', case when order_row.id is null then null else to_jsonb(order_row) end
  );
end;
$$;

revoke all on function private.service_undo_purchase_recommendation_action(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.service_undo_purchase_recommendation_action(uuid, uuid, uuid)
  to service_role;

create or replace function public.service_undo_purchase_recommendation_action(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_undo_purchase_recommendation_action(
    p_actor_user_id,
    p_restaurant_id,
    p_recommendation_id
  );
$$;

revoke all on function public.service_undo_purchase_recommendation_action(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_undo_purchase_recommendation_action(uuid, uuid, uuid)
  to service_role;

comment on function public.service_undo_purchase_recommendation_action(uuid, uuid, uuid) is
  'Service-owned recommendation undo. Restores original_recommended_quantity into recommended_quantity when undoing an edited approval.';
