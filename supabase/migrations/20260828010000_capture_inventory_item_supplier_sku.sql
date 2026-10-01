-- Manager+ capture of a scanned barcode onto supplier_items.supplier_sku,
-- linked to a same-tenant inventory item. Clients never write supplier_items
-- directly; this SECURITY DEFINER RPC is the only authenticated mutation path.

create or replace function private.normalize_inventory_barcode_token(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_value, '')), '[^a-zA-Z0-9]+', '', 'g')
  );
$$;

revoke all on function private.normalize_inventory_barcode_token(text)
from public, anon, authenticated, service_role;

create or replace function public.capture_inventory_item_supplier_sku(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_supplier_sku text
)
returns public.supplier_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  inventory_row public.inventory_items%rowtype;
  supplier_row public.supplier_items%rowtype;
  normalized_sku text := pg_catalog.btrim(coalesce(p_supplier_sku, ''));
  sku_token text := private.normalize_inventory_barcode_token(normalized_sku);
  conflict_row_id uuid;
  changed boolean := false;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if pg_catalog.length(normalized_sku) < 1
    or pg_catalog.length(normalized_sku) > 64
    or normalized_sku ~ '[[:cntrl:]]'
  then
    raise exception 'Supplier SKU barcode is invalid' using errcode = '22023';
  end if;

  if sku_token is null or sku_token = '' then
    raise exception 'Supplier SKU barcode is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || 'inventory_barcode_sku' || E'\x1f' || sku_token,
      0
    )
  );

  select * into inventory_row
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  for update;
  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

  select entry.id
  into conflict_row_id
  from public.supplier_items entry
  where entry.restaurant_id = p_restaurant_id
    and private.normalize_inventory_barcode_token(entry.supplier_sku) = sku_token
    and (
      (
        entry.inventory_item_id is not null
        and entry.inventory_item_id is distinct from p_inventory_item_id
      )
      or (
        entry.inventory_item_id is null
        and not (
          entry.supplier_id is not distinct from inventory_row.supplier_id
          and pg_catalog.lower(pg_catalog.btrim(entry.item_name))
            = pg_catalog.lower(pg_catalog.btrim(inventory_row.item_name))
          and pg_catalog.lower(pg_catalog.btrim(entry.unit))
            = pg_catalog.lower(pg_catalog.btrim(inventory_row.unit))
        )
      )
    )
  limit 1;
  if found then
    raise exception 'That barcode is already linked to another inventory item.'
      using errcode = '23505';
  end if;

  select * into supplier_row
  from public.supplier_items entry
  where entry.restaurant_id = p_restaurant_id
    and entry.inventory_item_id = p_inventory_item_id
    and entry.preferred is true
  order by entry.updated_at desc, entry.id desc
  limit 1
  for update;

  if not found then
    select * into supplier_row
    from public.supplier_items entry
    where entry.restaurant_id = p_restaurant_id
      and entry.supplier_id is not distinct from inventory_row.supplier_id
      and pg_catalog.lower(pg_catalog.btrim(entry.item_name))
        = pg_catalog.lower(pg_catalog.btrim(inventory_row.item_name))
      and pg_catalog.lower(pg_catalog.btrim(entry.unit))
        = pg_catalog.lower(pg_catalog.btrim(inventory_row.unit))
    order by entry.preferred desc, entry.updated_at desc, entry.id desc
    limit 1
    for update;
  end if;

  if found then
    changed :=
      supplier_row.supplier_sku is distinct from normalized_sku
      or supplier_row.inventory_item_id is distinct from p_inventory_item_id
      or supplier_row.supplier_id is distinct from inventory_row.supplier_id
      or supplier_row.supplier_name is distinct from inventory_row.supplier_name
      or supplier_row.item_name is distinct from inventory_row.item_name
      or supplier_row.unit is distinct from inventory_row.unit;

    if changed then
      update public.supplier_items entry
      set supplier_sku = normalized_sku,
        inventory_item_id = p_inventory_item_id,
        supplier_id = inventory_row.supplier_id,
        supplier_name = inventory_row.supplier_name,
        item_name = inventory_row.item_name,
        unit = inventory_row.unit,
        updated_at = pg_catalog.now()
      where entry.id = supplier_row.id
        and entry.restaurant_id = p_restaurant_id
      returning * into supplier_row;
    end if;
  else
    insert into public.supplier_items (
      restaurant_id,
      supplier_id,
      supplier_name,
      supplier_sku,
      inventory_item_id,
      item_name,
      unit,
      pack_size,
      estimated_unit_cost,
      preferred
    ) values (
      p_restaurant_id,
      inventory_row.supplier_id,
      inventory_row.supplier_name,
      normalized_sku,
      p_inventory_item_id,
      inventory_row.item_name,
      inventory_row.unit,
      null,
      inventory_row.estimated_unit_cost,
      true
    )
    returning * into supplier_row;
    changed := true;
  end if;

  if changed then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id,
      actor_user_id,
      'inventory_barcode_sku_captured',
      'supplier_items',
      supplier_row.id,
      pg_catalog.jsonb_build_object(
        'inventory_item_id', p_inventory_item_id,
        'supplier_id', inventory_row.supplier_id,
        'sku_token_length', pg_catalog.length(sku_token)
      )
    );
  end if;

  return supplier_row;
end;
$$;

revoke all on function public.capture_inventory_item_supplier_sku(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.capture_inventory_item_supplier_sku(uuid, uuid, text)
to authenticated;
