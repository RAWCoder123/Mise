-- Stabilize Mise's recommendation -> supplier draft -> sent order lifecycle.
-- All public functions are SECURITY INVOKER so existing RLS remains the
-- authorization boundary. Each call is one PostgreSQL transaction.

alter table public.purchase_recommendations
  add column if not exists supplier_order_id uuid;

alter table public.supplier_orders
  add column if not exists operator_note text;

-- Repair legacy duplicates before adding the partial uniqueness guarantees.
with ranked_pending as (
  select
    id,
    row_number() over (
      partition by restaurant_id, inventory_item_id
      order by created_at desc, id desc
    ) as row_rank
  from public.purchase_recommendations
  where status = 'pending'
)
delete from public.purchase_recommendations recommendation
using ranked_pending duplicate
where recommendation.id = duplicate.id
  and duplicate.row_rank > 1;

with ranked_drafts as (
  select
    id,
    row_number() over (
      partition by restaurant_id, supplier_name
      order by created_at desc, id desc
    ) as row_rank
  from public.supplier_orders
  where status = 'draft'
)
delete from public.supplier_orders supplier_order
using ranked_drafts duplicate
where supplier_order.id = duplicate.id
  and duplicate.row_rank > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'supplier_orders_restaurant_id_id_key'
      and conrelid = 'public.supplier_orders'::regclass
  ) then
    alter table public.supplier_orders
      add constraint supplier_orders_restaurant_id_id_key unique (restaurant_id, id);
  end if;
end $$;

-- Best-effort links for legacy handled rows. Pending and dismissed rows remain
-- deliberately unlinked.
update public.purchase_recommendations recommendation
set supplier_order_id = (
  select supplier_order.id
  from public.supplier_orders supplier_order
  where supplier_order.restaurant_id = recommendation.restaurant_id
    and supplier_order.supplier_name = recommendation.supplier_name
    and supplier_order.status = 'draft'
  order by supplier_order.created_at desc, supplier_order.id desc
  limit 1
)
where recommendation.status = 'approved'
  and recommendation.supplier_order_id is null;

update public.purchase_recommendations recommendation
set supplier_order_id = (
  select supplier_order.id
  from public.supplier_orders supplier_order
  where supplier_order.restaurant_id = recommendation.restaurant_id
    and supplier_order.supplier_name = recommendation.supplier_name
    and supplier_order.status in ('sent', 'completed')
  order by supplier_order.created_at desc, supplier_order.id desc
  limit 1
)
where recommendation.status = 'ordered'
  and recommendation.supplier_order_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchase_recommendations_supplier_order_tenant_fkey'
      and conrelid = 'public.purchase_recommendations'::regclass
  ) then
    alter table public.purchase_recommendations
      add constraint purchase_recommendations_supplier_order_tenant_fkey
      foreign key (restaurant_id, supplier_order_id)
      references public.supplier_orders(restaurant_id, id)
      on delete restrict;
  end if;
end $$;

create unique index if not exists purchase_recommendations_pending_item_idx
  on public.purchase_recommendations (restaurant_id, inventory_item_id)
  where status = 'pending';

create unique index if not exists supplier_orders_draft_supplier_idx
  on public.supplier_orders (restaurant_id, supplier_name)
  where status = 'draft';

create index if not exists purchase_recommendations_supplier_order_idx
  on public.purchase_recommendations (restaurant_id, supplier_order_id)
  where supplier_order_id is not null;

comment on column public.purchase_recommendations.supplier_order_id is
  'Exact supplier order lifecycle containing this approved or ordered recommendation.';
comment on column public.supplier_orders.operator_note is
  'Optional operator-authored supplier instruction; generated order lines remain system-owned.';

drop policy if exists "Managers can delete draft supplier orders" on public.supplier_orders;
create policy "Managers can delete draft supplier orders"
on public.supplier_orders for delete to authenticated
using (
  status = 'draft'
  and private.has_restaurant_role(restaurant_id, array['owner', 'admin', 'manager'])
);

create or replace function private.build_supplier_order_message(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_supplier_name text,
  p_operator_note text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  with generated_lines as (
    select string_agg(
      recommendation.item_name || ' - ' || recommendation.recommended_quantity::text || ' ' || recommendation.unit,
      E'\n'
      order by recommendation.item_name, recommendation.id
    ) as body
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
  )
  select
    'Order draft for ' || p_supplier_name || E'\n\n' ||
    coalesce(generated_lines.body, '') ||
    E'\n\nDelivery requested: Tomorrow morning' ||
    case
      when nullif(trim(p_operator_note), '') is null then ''
      else E'\n\nNotes:\n' || trim(p_operator_note)
    end
  from generated_lines;
$$;

create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  previous_status text;
  workflow_outcome text := 'applied';
begin
  if not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager']) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is not null and p_recommended_quantity < 0 then
    raise exception 'Enter a valid order quantity';
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

create or replace function public.dismiss_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  previous_status text;
  workflow_outcome text := 'applied';
begin
  if not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager']) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
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
    set status = 'dismissed', supplier_order_id = null
    where restaurant_id = p_restaurant_id
      and id = p_recommendation_id
    returning * into recommendation_row;

    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      auth.uid(),
      'recommendation_dismissed',
      'purchase_recommendations',
      recommendation_row.id,
      jsonb_build_object(
        'supplier_name', recommendation_row.supplier_name,
        'urgency', recommendation_row.urgency
      )
    );
  end if;

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', null
  );
end;
$$;

create or replace function public.undo_purchase_recommendation_action(
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  previous_status text;
  remaining_count integer := 0;
begin
  if not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager']) then
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
  set status = 'pending', supplier_order_id = null
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

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    auth.uid(),
    'recommendation_undo',
    'purchase_recommendations',
    recommendation_row.id,
    jsonb_build_object(
      'previous_status', previous_status,
      'supplier_name', recommendation_row.supplier_name
    )
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', case when order_row.id is null then null else to_jsonb(order_row) end
  );
end;
$$;

create or replace function public.update_supplier_order_draft(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_operator_note text,
  p_set_operator_note boolean,
  p_delivery_date date,
  p_set_delivery_date boolean
)
returns public.supplier_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
begin
  if not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager']) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found'; end if;
  if order_row.status <> 'draft' then raise exception 'Sent orders cannot be edited'; end if;

  update public.supplier_orders
  set
    operator_note = case
      when p_set_operator_note then nullif(trim(p_operator_note), '')
      else operator_note
    end,
    delivery_date = case
      when p_set_delivery_date then p_delivery_date
      else delivery_date
    end
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  returning * into order_row;

  update public.supplier_orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id,
    order_row.id,
    order_row.supplier_name,
    order_row.operator_note
  )
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  returning * into order_row;

  return order_row;
end;
$$;

create or replace function public.mark_supplier_order_sent(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  ordered_rows jsonb := '[]'::jsonb;
  workflow_outcome text := 'applied';
begin
  if not private.has_restaurant_role(p_restaurant_id, array['owner', 'admin', 'manager']) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found'; end if;

  if order_row.status in ('sent', 'completed') then
    workflow_outcome := 'already_applied';
  else
    update public.supplier_orders
    set status = 'sent'
    where restaurant_id = p_restaurant_id
      and id = p_order_id
      and status = 'draft'
    returning * into order_row;

    update public.purchase_recommendations
    set status = 'ordered'
    where restaurant_id = p_restaurant_id
      and supplier_order_id = p_order_id
      and status = 'approved';

    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      auth.uid(),
      'supplier_order_sent',
      'supplier_orders',
      order_row.id,
      jsonb_build_object(
        'supplier_name', order_row.supplier_name,
        'ordered_recommendation_count', (
          select count(*)
          from public.purchase_recommendations recommendation
          where recommendation.restaurant_id = p_restaurant_id
            and recommendation.supplier_order_id = p_order_id
            and recommendation.status = 'ordered'
        )
      )
    );
  end if;

  select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at), '[]'::jsonb)
  into ordered_rows
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'ordered';

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'order', to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

revoke all on function private.build_supplier_order_message(uuid, uuid, text, text) from public, anon;
revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric) from public, anon;
revoke all on function public.dismiss_purchase_recommendation(uuid, uuid) from public, anon;
revoke all on function public.undo_purchase_recommendation_action(uuid, uuid) from public, anon;
revoke all on function public.update_supplier_order_draft(uuid, uuid, text, boolean, date, boolean) from public, anon;
revoke all on function public.mark_supplier_order_sent(uuid, uuid) from public, anon;

grant execute on function private.build_supplier_order_message(uuid, uuid, text, text) to authenticated;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric) to authenticated;
grant execute on function public.dismiss_purchase_recommendation(uuid, uuid) to authenticated;
grant execute on function public.undo_purchase_recommendation_action(uuid, uuid) to authenticated;
grant execute on function public.update_supplier_order_draft(uuid, uuid, text, boolean, date, boolean) to authenticated;
grant execute on function public.mark_supplier_order_sent(uuid, uuid) to authenticated;
