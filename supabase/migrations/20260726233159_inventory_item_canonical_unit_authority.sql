alter table public.inventory_items
  add column if not exists canonical_unit text,
  add column if not exists canonical_unit_verification_status text not null default 'draft',
  add column if not exists canonical_unit_verified_at timestamptz,
  add column if not exists canonical_unit_verified_by uuid references auth.users(id) on delete set null;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_canonical_unit_check
    check (canonical_unit is null or canonical_unit in ('g', 'ml', 'each'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_canonical_unit_verification_status_check
    check (canonical_unit_verification_status in ('draft', 'verified', 'rejected', 'expired'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.inventory_items
    add constraint inventory_items_verified_canonical_unit_check
    check (
      canonical_unit_verification_status <> 'verified'
      or (
        canonical_unit is not null
        and canonical_unit_verified_at is not null
      )
    );
exception
  when duplicate_object then null;
end
$$;

create or replace function private.canonical_unit_for_standard_unit(p_unit text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case lower(trim(coalesce(p_unit, '')))
    when 'g' then 'g'
    when 'gram' then 'g'
    when 'grams' then 'g'
    when 'kg' then 'g'
    when 'kilogram' then 'g'
    when 'kilograms' then 'g'
    when 'oz' then 'g'
    when 'ounce' then 'g'
    when 'ounces' then 'g'
    when 'lb' then 'g'
    when 'lbs' then 'g'
    when 'pound' then 'g'
    when 'pounds' then 'g'
    when 'ml' then 'ml'
    when 'milliliter' then 'ml'
    when 'milliliters' then 'ml'
    when 'l' then 'ml'
    when 'liter' then 'ml'
    when 'liters' then 'ml'
    when 'tsp' then 'ml'
    when 'teaspoon' then 'ml'
    when 'teaspoons' then 'ml'
    when 'tbsp' then 'ml'
    when 'tablespoon' then 'ml'
    when 'tablespoons' then 'ml'
    when 'fl oz' then 'ml'
    when 'fluid ounce' then 'ml'
    when 'fluid ounces' then 'ml'
    when 'each' then 'each'
    when 'ea' then 'each'
    when 'count' then 'each'
    when 'unit' then 'each'
    else null
  end
$$;

create or replace function private.normalize_inventory_item_canonical_unit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inferred_unit text;
begin
  if tg_op = 'INSERT' or new.unit is distinct from old.unit then
    inferred_unit := private.canonical_unit_for_standard_unit(new.unit);
    if inferred_unit is null then
      new.canonical_unit := null;
      new.canonical_unit_verification_status := 'draft';
      new.canonical_unit_verified_at := null;
      new.canonical_unit_verified_by := null;
    else
      new.canonical_unit := inferred_unit;
      new.canonical_unit_verification_status := 'verified';
      new.canonical_unit_verified_at := now();
      new.canonical_unit_verified_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_inventory_item_canonical_unit on public.inventory_items;
create trigger normalize_inventory_item_canonical_unit
before insert or update of unit on public.inventory_items
for each row execute function private.normalize_inventory_item_canonical_unit();

update public.inventory_items item
set
  canonical_unit = private.canonical_unit_for_standard_unit(item.unit),
  canonical_unit_verification_status = case
    when private.canonical_unit_for_standard_unit(item.unit) is null then 'draft'
    else 'verified'
  end,
  canonical_unit_verified_at = case
    when private.canonical_unit_for_standard_unit(item.unit) is null then null
    else coalesce(item.canonical_unit_verified_at, now())
  end,
  canonical_unit_verified_by = case
    when private.canonical_unit_for_standard_unit(item.unit) is null then null
    else item.canonical_unit_verified_by
  end
where item.canonical_unit_verification_status <> 'verified'
   or item.canonical_unit is null;

create or replace function private.enforce_inventory_event_canonical_unit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_unit text;
  item_verification_status text;
begin
  select item.canonical_unit, item.canonical_unit_verification_status
  into item_unit, item_verification_status
  from public.inventory_items item
  where item.restaurant_id = new.restaurant_id
    and item.id = new.inventory_item_id;

  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;
  if item_verification_status <> 'verified' or item_unit is null then
    raise exception 'Inventory item canonical unit is not verified' using errcode = '22023';
  end if;
  if item_unit <> new.canonical_unit then
    raise exception 'Inventory event canonical unit does not match inventory item' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_inventory_event_canonical_unit on public.inventory_events;
create trigger enforce_inventory_event_canonical_unit
before insert on public.inventory_events
for each row execute function private.enforce_inventory_event_canonical_unit();

create or replace function public.verify_inventory_item_canonical_unit(
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_canonical_unit text
)
returns public.inventory_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_item public.inventory_items;
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

  update public.inventory_items item
  set
    canonical_unit = p_canonical_unit,
    canonical_unit_verification_status = 'verified',
    canonical_unit_verified_at = now(),
    canonical_unit_verified_by = auth.uid(),
    last_updated = now()
  where item.restaurant_id = p_restaurant_id
    and item.id = p_inventory_item_id
  returning item.* into verified_item;

  if not found then
    raise exception 'Inventory item not found for restaurant' using errcode = '23503';
  end if;

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
    jsonb_build_object('canonical_unit', verified_item.canonical_unit)
  );

  return verified_item;
end;
$$;

revoke all on function private.canonical_unit_for_standard_unit(text)
  from public, anon, authenticated;
revoke all on function private.normalize_inventory_item_canonical_unit()
  from public, anon, authenticated;
revoke all on function private.enforce_inventory_event_canonical_unit()
  from public, anon, authenticated;
revoke all on function public.verify_inventory_item_canonical_unit(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.verify_inventory_item_canonical_unit(uuid, uuid, text)
  to authenticated;
