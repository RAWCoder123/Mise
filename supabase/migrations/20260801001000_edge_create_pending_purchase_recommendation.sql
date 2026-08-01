-- Route manual pending purchase recommendation creation through a service-owned
-- RPC so authenticated clients must use operational-workflows (Edge firewall +
-- audit), matching approve/dismiss/undo recommendation mutations.

create or replace function private.service_create_pending_purchase_recommendation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_recommended_quantity numeric,
  p_reason text,
  p_urgency text
)
returns public.purchase_recommendations
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  normalized_reason text;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if p_recommended_quantity is null
    or p_recommended_quantity <= 0
    or p_recommended_quantity > 1000000
    or p_recommended_quantity::text in ('NaN', 'Infinity', '-Infinity')
  then
    raise exception 'Enter a valid order quantity' using errcode = '22023';
  end if;
  if p_urgency not in ('low', 'medium', 'high') then
    raise exception 'Unsupported recommendation urgency' using errcode = '22023';
  end if;

  normalized_reason := btrim(coalesce(p_reason, ''));
  if normalized_reason = '' or char_length(normalized_reason) > 2000 then
    raise exception 'Enter a valid recommendation reason' using errcode = '22023';
  end if;
  if normalized_reason ~ '[[:cntrl:]]' then
    raise exception 'Recommendation reason is invalid' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text || E'\x1f' || p_inventory_item_id::text, 0)
  );

  select * into item_row
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and id = p_inventory_item_id;
  if not found then raise exception 'Inventory item not found'; end if;

  select * into recommendation_row
  from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and inventory_item_id = p_inventory_item_id
    and status = 'pending'
  for update;

  if found then return recommendation_row; end if;

  insert into public.purchase_recommendations (
    restaurant_id,
    inventory_item_id,
    item_name,
    supplier_name,
    recommended_quantity,
    unit,
    reason,
    urgency,
    status,
    supplier_order_id
  ) values (
    p_restaurant_id,
    item_row.id,
    item_row.item_name,
    item_row.supplier_name,
    p_recommended_quantity,
    item_row.unit,
    normalized_reason,
    p_urgency,
    'pending',
    null
  )
  returning * into recommendation_row;

  -- Domain audit is recorded by operational-workflows after this RPC returns
  -- so clients cannot bypass Edge reservation/logging.

  return recommendation_row;
end;
$$;

revoke all on function private.service_create_pending_purchase_recommendation(
  uuid, uuid, uuid, numeric, text, text
) from public, anon, authenticated;
grant execute on function private.service_create_pending_purchase_recommendation(
  uuid, uuid, uuid, numeric, text, text
) to service_role;

create or replace function public.service_create_pending_purchase_recommendation(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_recommended_quantity numeric,
  p_reason text,
  p_urgency text
)
returns public.purchase_recommendations
language sql
security invoker
set search_path = ''
as $$
  select private.service_create_pending_purchase_recommendation(
    p_actor_user_id,
    p_restaurant_id,
    p_inventory_item_id,
    p_recommended_quantity,
    p_reason,
    p_urgency
  );
$$;

revoke all on function public.service_create_pending_purchase_recommendation(
  uuid, uuid, uuid, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.service_create_pending_purchase_recommendation(
  uuid, uuid, uuid, numeric, text, text
) to service_role;

comment on function public.service_create_pending_purchase_recommendation(
  uuid, uuid, uuid, numeric, text, text
) is
  'Service-owned pending recommendation create. Authenticated clients must call through operational-workflows.';

-- Keep the auth.uid()-bound RPC for backwards-compatible SQL callers, but revoke
-- Data API execute so Expo clients cannot bypass Edge reservation/audit.
revoke all on function public.create_pending_purchase_recommendation(
  uuid, uuid, numeric, text, text
) from public, anon, authenticated, service_role;
