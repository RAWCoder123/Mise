-- Route storage-location create and external supplier placement through
-- service-owned RPCs so authenticated clients must use operational-workflows
-- (Edge firewall reservation + audit), matching transfer/receive patterns.

create or replace function private.service_create_storage_location(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_name text
)
returns public.storage_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  created_row public.storage_locations%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  normalized_name := btrim(coalesce(p_name, ''));
  if char_length(normalized_name) < 1 or char_length(normalized_name) > 80 then
    raise exception 'Storage location name must be between 1 and 80 characters' using errcode = '22023';
  end if;
  if normalized_name ~ '[[:cntrl:]]' then
    raise exception 'Storage location name is invalid' using errcode = '22023';
  end if;
  if lower(normalized_name) = 'main' then
    raise exception '"Main" is reserved and created automatically' using errcode = '22023';
  end if;

  perform private.ensure_main_storage_location(p_restaurant_id);

  insert into public.storage_locations (
    restaurant_id,
    name,
    sort_order,
    is_active
  ) values (
    p_restaurant_id,
    normalized_name,
    100,
    true
  )
  returning * into created_row;

  return created_row;
exception
  when unique_violation then
    raise exception 'A storage location with that name already exists' using errcode = '23505';
end;
$$;

revoke all on function private.service_create_storage_location(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.service_create_storage_location(uuid, uuid, text)
  to service_role;

create or replace function public.service_create_storage_location(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_name text
)
returns public.storage_locations
language sql
security invoker
set search_path = ''
as $$
  select private.service_create_storage_location(
    p_actor_user_id,
    p_restaurant_id,
    p_name
  );
$$;

revoke all on function public.service_create_storage_location(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_create_storage_location(uuid, uuid, text)
  to service_role;

comment on function public.service_create_storage_location(uuid, uuid, text) is
  'Service-owned storage location create. Authenticated clients must call through operational-workflows.';

-- Keep the auth.uid()-bound RPC for backwards-compatible SQL callers, but revoke
-- Data API execute so Expo clients cannot bypass Edge reservation/audit.
revoke all on function public.create_storage_location(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.service_confirm_supplier_order_placed(
  p_actor_user_id uuid,
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
  ordered_rows jsonb := '[]'::jsonb;
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

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id
    and id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found'; end if;

  if order_row.status in ('sent', 'completed') then
    workflow_outcome := 'already_applied';
  elsif order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be confirmed as placed' using errcode = '22023';
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

    -- Domain audit is recorded by operational-workflows after this RPC returns
    -- (same pattern as receive/transfer) so clients cannot bypass Edge logging.
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

revoke all on function private.service_confirm_supplier_order_placed(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.service_confirm_supplier_order_placed(uuid, uuid, uuid)
  to service_role;

create or replace function public.service_confirm_supplier_order_placed(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_confirm_supplier_order_placed(
    p_actor_user_id,
    p_restaurant_id,
    p_order_id
  );
$$;

revoke all on function public.service_confirm_supplier_order_placed(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.service_confirm_supplier_order_placed(uuid, uuid, uuid)
  to service_role;

comment on function public.service_confirm_supplier_order_placed(uuid, uuid, uuid) is
  'Service-owned external supplier placement confirmation. Authenticated clients must call through operational-workflows.';

revoke all on function public.confirm_supplier_order_placed(uuid, uuid)
  from public, anon, authenticated, service_role;
