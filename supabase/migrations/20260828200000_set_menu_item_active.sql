-- Managers can activate or deactivate menu items without client DML on menu_items.
-- Inactive items remain readable for reactivation, but planning / purchase / mapping
-- joins already require menu_items.active = true. The existing planning-revision
-- trigger fires on active changes.

create or replace function public.set_menu_item_active(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_row public.menu_items%rowtype;
  audit_action text;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_menu_item_id is null or p_active is null then
    raise exception 'Menu item active state is incomplete' using errcode = '22023';
  end if;

  select * into item_row
  from public.menu_items item
  where item.restaurant_id = p_restaurant_id and item.id = p_menu_item_id
  for update;
  if not found then
    raise exception 'Menu item not found' using errcode = '22023';
  end if;

  if item_row.active is not distinct from p_active then
    return jsonb_build_object(
      'menuItemId', item_row.id,
      'menuItemName', item_row.name,
      'active', item_row.active,
      'recipeRevision', item_row.recipe_revision,
      'confirmedRevision', item_row.recipe_confirmed_revision,
      'confirmedAt', item_row.recipe_confirmed_at,
      'ready', item_row.active
        and coalesce(item_row.recipe_confirmed_revision = item_row.recipe_revision, false)
        and exists (
          select 1 from public.menu_item_ingredients ingredient
          where ingredient.restaurant_id = p_restaurant_id
            and ingredient.menu_item_id = item_row.id
        )
    );
  end if;

  update public.menu_items
  set active = p_active,
      updated_at = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_menu_item_id
  returning * into item_row;

  audit_action := case when p_active then 'menu_item_activated' else 'menu_item_deactivated' end;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), audit_action, 'menu_items', item_row.id,
    jsonb_build_object(
      'active', item_row.active,
      'recipe_revision', item_row.recipe_revision
    )
  );

  return jsonb_build_object(
    'menuItemId', item_row.id,
    'menuItemName', item_row.name,
    'active', item_row.active,
    'recipeRevision', item_row.recipe_revision,
    'confirmedRevision', item_row.recipe_confirmed_revision,
    'confirmedAt', item_row.recipe_confirmed_at,
    'ready', item_row.active
      and coalesce(item_row.recipe_confirmed_revision = item_row.recipe_revision, false)
      and exists (
        select 1 from public.menu_item_ingredients ingredient
        where ingredient.restaurant_id = p_restaurant_id
          and ingredient.menu_item_id = item_row.id
      )
  );
end;
$$;

revoke all on function public.set_menu_item_active(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_menu_item_active(uuid, uuid, boolean)
  to authenticated;

comment on function public.set_menu_item_active(uuid, uuid, boolean) is
  'Owner/admin/manager toggle for menu_items.active; audited; planning revision bumps via trigger.';
