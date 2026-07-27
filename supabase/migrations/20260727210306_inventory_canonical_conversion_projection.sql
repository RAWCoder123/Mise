alter table public.inventory_items
  add column if not exists canonical_quantity_per_unit numeric;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_canonical_quantity_per_unit_check
    check (
      canonical_quantity_per_unit is null
      or (
        canonical_quantity_per_unit > 0
        and canonical_quantity_per_unit <= 1000000000
      )
    );
exception
  when duplicate_object then null;
end
$$;

create or replace function private.canonical_quantity_per_standard_unit(p_unit text)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select case lower(trim(coalesce(p_unit, '')))
    when 'g' then 1
    when 'gram' then 1
    when 'grams' then 1
    when 'kg' then 1000
    when 'kilogram' then 1000
    when 'kilograms' then 1000
    when 'oz' then 28.349523125
    when 'ounce' then 28.349523125
    when 'ounces' then 28.349523125
    when 'lb' then 453.59237
    when 'lbs' then 453.59237
    when 'pound' then 453.59237
    when 'pounds' then 453.59237
    when 'ml' then 1
    when 'milliliter' then 1
    when 'milliliters' then 1
    when 'l' then 1000
    when 'liter' then 1000
    when 'liters' then 1000
    when 'tsp' then 4.92892159375
    when 'teaspoon' then 4.92892159375
    when 'teaspoons' then 4.92892159375
    when 'tbsp' then 14.78676478125
    when 'tablespoon' then 14.78676478125
    when 'tablespoons' then 14.78676478125
    when 'fl oz' then 29.5735295625
    when 'fluid ounce' then 29.5735295625
    when 'fluid ounces' then 29.5735295625
    when 'each' then 1
    when 'ea' then 1
    when 'count' then 1
    when 'unit' then 1
    else null
  end
$$;

create or replace function private.normalize_inventory_item_canonical_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_unit text;
  inferred_quantity numeric;
begin
  if tg_op = 'INSERT' or new.unit is distinct from old.unit then
    inferred_unit := private.canonical_unit_for_standard_unit(new.unit);
    inferred_quantity := private.canonical_quantity_per_standard_unit(new.unit);
    if inferred_unit is null or inferred_quantity is null then
      new.canonical_unit := null;
      new.canonical_quantity_per_unit := null;
      new.canonical_unit_verification_status := 'draft';
      new.canonical_unit_verified_at := null;
      new.canonical_unit_verified_by := null;
    else
      new.canonical_unit := inferred_unit;
      new.canonical_quantity_per_unit := inferred_quantity;
      new.canonical_unit_verification_status := 'verified';
      new.canonical_unit_verified_at := now();
      new.canonical_unit_verified_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

update public.inventory_items item
set canonical_quantity_per_unit =
  private.canonical_quantity_per_standard_unit(item.unit)
where item.canonical_unit_verification_status = 'verified'
  and item.canonical_quantity_per_unit is null;

alter table public.inventory_items
  drop constraint if exists inventory_items_verified_canonical_unit_check;

alter table public.inventory_items
  add constraint inventory_items_verified_canonical_unit_check
  check (
    canonical_unit_verification_status <> 'verified'
    or (
      canonical_unit is not null
      and canonical_quantity_per_unit is not null
      and canonical_unit_verified_at is not null
    )
  );

create or replace function private.enforce_inventory_event_canonical_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_unit text;
  item_quantity_per_unit numeric;
  item_verification_status text;
begin
  select
    item.canonical_unit,
    item.canonical_quantity_per_unit,
    item.canonical_unit_verification_status
  into item_unit, item_quantity_per_unit, item_verification_status
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;
  if item_verification_status <> 'verified'
    or item_unit is null
    or item_quantity_per_unit is null
  then
    raise exception 'Inventory item canonical conversion is not verified' using errcode = '22023';
  end if;
  if item_unit <> new.canonical_unit then
    raise exception 'Inventory event canonical unit does not match inventory item' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop function if exists public.verify_inventory_item_canonical_unit(uuid, uuid, text);

create function public.verify_inventory_item_canonical_unit(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_canonical_unit text,
  p_canonical_quantity_per_unit numeric
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_item public.inventory_items;
  inferred_unit text;
  inferred_quantity numeric;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if p_canonical_unit not in ('g', 'ml', 'each') then
    raise exception 'Canonical unit must be g, ml, or each' using errcode = '22023';
  end if;
  if p_canonical_quantity_per_unit is null
    or p_canonical_quantity_per_unit <= 0
    or p_canonical_quantity_per_unit > 1000000000
  then
    raise exception 'Canonical quantity per inventory unit is invalid' using errcode = '22023';
  end if;

  select
    private.canonical_unit_for_standard_unit(item.unit),
    private.canonical_quantity_per_standard_unit(item.unit)
  into inferred_unit, inferred_quantity
  from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;
  if inferred_unit is not null
    and (
      inferred_unit <> p_canonical_unit
      or inferred_quantity <> p_canonical_quantity_per_unit
    )
  then
    raise exception 'Standard-unit canonical conversion cannot be overridden' using errcode = '22023';
  end if;

  update public.inventory_items item
  set
    canonical_unit = p_canonical_unit,
    canonical_quantity_per_unit = p_canonical_quantity_per_unit,
    canonical_unit_verification_status = 'verified',
    canonical_unit_verified_at = now(),
    canonical_unit_verified_by = auth.uid(),
    last_updated = now()
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  returning item.* into verified_item;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  values (
    p_restaurant_id,
    auth.uid(),
    'inventory_item.canonical_unit_verified',
    'inventory_items',
    verified_item.id,
    jsonb_build_object(
      'canonical_unit', verified_item.canonical_unit,
      'canonical_quantity_per_unit', verified_item.canonical_quantity_per_unit
    )
  );

  return verified_item;
end;
$$;

create or replace function private.apply_inventory_event_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior_quantity numeric;
  quantity_per_unit numeric;
  native_event_quantity numeric;
  projected_quantity numeric;
begin
  select item.current_quantity, item.canonical_quantity_per_unit
  into prior_quantity, quantity_per_unit
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id
  for update;

  if not found then
    raise exception 'Inventory item not found for projection'
      using errcode = '23503';
  end if;
  if quantity_per_unit is null or quantity_per_unit <= 0 then
    raise exception 'Inventory item canonical conversion is not verified'
      using errcode = '22023';
  end if;

  native_event_quantity := new.quantity / quantity_per_unit;
  projected_quantity := case
    when new.event_type = 'count' then native_event_quantity
    when new.event_type = 'stockout' then 0
    when new.event_type = 'receipt' then prior_quantity + native_event_quantity
    when new.event_type in ('waste', 'usage') then prior_quantity - native_event_quantity
    else prior_quantity + native_event_quantity
  end;

  if projected_quantity is null
    or projected_quantity < 0
    or projected_quantity > 1000000
  then
    raise exception 'Inventory event would move on-hand outside supported limits'
      using errcode = '22023';
  end if;

  update public.inventory_items
  set current_quantity = projected_quantity,
      last_updated = clock_timestamp()
  where restaurant_id = new.restaurant_id
    and id = new.inventory_item_id;

  return new;
end;
$$;

revoke all on function private.canonical_quantity_per_standard_unit(text)
  from public, anon, authenticated, service_role;
revoke all on function private.normalize_inventory_item_canonical_unit()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_inventory_event_canonical_unit()
  from public, anon, authenticated, service_role;
revoke all on function private.apply_inventory_event_projection()
  from public, anon, authenticated, service_role;
revoke all on function public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric)
  from public, anon, authenticated;
grant execute on function public.verify_inventory_item_canonical_unit(uuid, uuid, text, numeric)
  to authenticated;

comment on column public.inventory_items.canonical_quantity_per_unit is
  'Verified canonical quantity represented by one inventory_items.unit; required for authoritative ledger projection.';

comment on function private.apply_inventory_event_projection() is
  'Converts canonical event quantities into the item native unit and atomically projects append-only history into current_quantity.';
