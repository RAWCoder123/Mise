-- Allow managers/staff to begin a cycle/spot inventory count for a selected
-- subset of verified canonical inventory items. Null/empty scope keeps the
-- existing full-sheet begin behavior.

drop function if exists public.service_begin_inventory_count_session(uuid, uuid, text);
drop function if exists private.service_begin_inventory_count_session(uuid, uuid, text);

create or replace function private.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null,
  p_inventory_item_ids uuid[] default null
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
  scoped boolean := coalesce(cardinality(p_inventory_item_ids), 0) > 0;
  requested_count integer := coalesce(cardinality(p_inventory_item_ids), 0);
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

  if scoped then
    if exists (
      select 1
      from unnest(p_inventory_item_ids) as requested(id)
      where requested.id is null
    ) then
      raise exception 'Count session inventory item ids are invalid' using errcode = '22023';
    end if;

    if (
      select count(*)::integer
      from unnest(p_inventory_item_ids) as requested(id)
    ) <> (
      select count(distinct requested.id)::integer
      from unnest(p_inventory_item_ids) as requested(id)
    ) then
      raise exception 'Count session inventory item ids must be unique' using errcode = '22023';
    end if;

    if requested_count > 250 then
      raise exception 'Count sessions support at most 250 items' using errcode = '22023';
    end if;

    select count(*)::integer into item_count
    from public.inventory_items as item
    where item.restaurant_id = p_restaurant_id
      and item.id = any (p_inventory_item_ids)
      and item.canonical_unit_verification_status = 'verified'
      and item.canonical_unit is not null
      and item.canonical_quantity_per_unit is not null
      and item.canonical_quantity_per_unit > 0;

    if item_count <> requested_count then
      raise exception 'One or more selected inventory items are not eligible for a count session'
        using errcode = '22023';
    end if;
  else
    -- Only verified canonical items can project count events. Starting with
    -- draft/unverified items would leave approve fail-closed after staff counted.
    select count(*)::integer into item_count
    from public.inventory_items
    where restaurant_id = p_restaurant_id
      and canonical_unit_verification_status = 'verified'
      and canonical_unit is not null
      and canonical_quantity_per_unit is not null
      and canonical_quantity_per_unit > 0;
    if item_count < 1 then
      raise exception 'Verify canonical units for inventory items before starting a count session'
        using errcode = '22023';
    end if;
    if item_count > 250 then
      raise exception 'Count sessions support at most 250 items' using errcode = '22023';
    end if;
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
    and item.canonical_unit_verification_status = 'verified'
    and item.canonical_unit is not null
    and item.canonical_quantity_per_unit is not null
    and item.canonical_quantity_per_unit > 0
    and (
      not scoped
      or item.id = any (p_inventory_item_ids)
    )
  order by item.item_name, item.id;

  return private.inventory_count_session_detail(session_id);
end;
$$;

create or replace function public.service_begin_inventory_count_session(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_note text default null,
  p_inventory_item_ids uuid[] default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_begin_inventory_count_session(
    p_actor_user_id,
    p_restaurant_id,
    p_note,
    p_inventory_item_ids
  );
$$;

revoke all on function public.service_begin_inventory_count_session(uuid, uuid, text, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function private.service_begin_inventory_count_session(uuid, uuid, text, uuid[])
  from public, anon, authenticated;

grant execute on function public.service_begin_inventory_count_session(uuid, uuid, text, uuid[])
  to service_role;
grant execute on function private.service_begin_inventory_count_session(uuid, uuid, text, uuid[])
  to service_role;

comment on function private.service_begin_inventory_count_session(uuid, uuid, text, uuid[]) is
  'Starts a multi-item count session for owner/admin/manager/staff; optional inventory item ids scope a cycle/spot count. Ledger changes still require manager approval.';
