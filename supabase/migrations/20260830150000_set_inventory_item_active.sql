-- Managers can activate or deactivate inventory items without client DML.
-- Inactive items remain readable for reactivation and ledger history, but are
-- excluded from new count sessions and client-side purchase recommendation
-- generation. POS consumption against mapped recipes is unchanged.

alter table public.inventory_items
  add column if not exists active boolean not null default true;

comment on column public.inventory_items.active is
  'When false, item stays readable for reactivation but is excluded from new count sessions and purchase planning.';

create or replace function public.set_inventory_item_active(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.inventory_items%rowtype;
  audit_action text;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_inventory_item_id is null or p_active is null then
    raise exception 'Inventory item active state is incomplete' using errcode = '22023';
  end if;

  select * into item_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found' using errcode = '22023';
  end if;

  if item_row.active is not distinct from p_active then
    return jsonb_build_object(
      'inventoryItemId', item_row.id,
      'itemName', item_row.item_name,
      'active', item_row.active,
      'lastUpdated', item_row.last_updated
    );
  end if;

  update public.inventory_items
  set active = p_active,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;

  audit_action := case
    when p_active then 'inventory_item_activated'
    else 'inventory_item_deactivated'
  end;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), audit_action, 'inventory_items', item_row.id,
    jsonb_build_object(
      'active', item_row.active,
      'item_name', item_row.item_name
    )
  );

  return jsonb_build_object(
    'inventoryItemId', item_row.id,
    'itemName', item_row.item_name,
    'active', item_row.active,
    'lastUpdated', item_row.last_updated
  );
end;
$$;

revoke all on function public.set_inventory_item_active(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_inventory_item_active(uuid, uuid, boolean)
  to authenticated;

comment on function public.set_inventory_item_active(uuid, uuid, boolean) is
  'Owner/admin/manager toggle for inventory_items.active; audited; no direct client UPDATE grant.';

-- Exclude inactive items from new multi-item count sessions.
create or replace function private.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_note text := nullif(btrim(coalesce(p_note, '')), '');
  open_session_id uuid;
  session_id uuid;
  item_count integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager', 'staff']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  if safe_note is not null and char_length(safe_note) > 240 then
    raise exception 'Count session note is outside supported limits' using errcode = '22023';
  end if;

  select id into open_session_id
  from public.inventory_count_sessions
  where restaurant_id = p_restaurant_id
    and status in ('in_progress', 'submitted')
  limit 1;
  if open_session_id is not null then
    raise exception 'A count session is already open for this restaurant' using errcode = '23505';
  end if;

  -- Only active, verified canonical items can project count events.
  select count(*)::integer into item_count
  from public.inventory_items
  where restaurant_id = p_restaurant_id
    and active is true
    and canonical_unit_verification_status = 'verified'
    and canonical_unit is not null
    and canonical_quantity_per_unit is not null
    and canonical_quantity_per_unit > 0;
  if item_count < 1 then
    raise exception 'Verify canonical units for inventory items before starting a count session' using errcode = '22023';
  end if;
  if item_count > 250 then
    raise exception 'Count sessions support at most 250 items' using errcode = '22023';
  end if;

  insert into public.inventory_count_sessions (
    restaurant_id, status, started_by, started_at, note
  ) values (
    p_restaurant_id, 'in_progress', p_actor_user_id, clock_timestamp(), safe_note
  )
  returning id into session_id;

  insert into public.inventory_count_lines (
    restaurant_id,
    session_id,
    inventory_item_id,
    item_name,
    unit,
    system_quantity_at_start
  )
  select
    p_restaurant_id,
    session_id,
    item.id,
    item.item_name,
    item.unit,
    item.current_quantity
  from public.inventory_items as item
  where item.restaurant_id = p_restaurant_id
    and item.active is true
    and item.canonical_unit_verification_status = 'verified'
    and item.canonical_unit is not null
    and item.canonical_quantity_per_unit is not null
    and item.canonical_quantity_per_unit > 0
  order by item.item_name, item.id;

  return private.inventory_count_session_detail(session_id);
end;
$$;

comment on function private.service_begin_inventory_count_session(uuid, uuid, text) is
  'Begin a multi-item inventory count session for active verified-canonical items only.';
