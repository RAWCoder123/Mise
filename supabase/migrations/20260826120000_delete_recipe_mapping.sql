-- Allow managers to unlink a wrong POS recipe mapping without rewriting
-- historical sales or inventory ledger rows. Future planning stops depleting
-- the unlinked ingredient once the mapping is removed.

create or replace function private.service_delete_recipe_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  commit_revision bigint;
  mapping_row public.menu_item_ingredients%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if p_mapping_id is null then
    raise exception 'Recipe mapping id is required' using errcode = '22023';
  end if;

  delete from public.menu_item_ingredients
  where restaurant_id = p_restaurant_id
    and id = p_mapping_id
  returning * into mapping_row;
  if not found then raise exception 'Recipe mapping not found'; end if;

  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );

  return jsonb_build_object(
    'deleted', true,
    'id', mapping_row.id,
    'menu_item_name', mapping_row.menu_item_name,
    'inventory_item_id', mapping_row.inventory_item_id,
    'quantity_used_per_sale', mapping_row.quantity_used_per_sale,
    'unit', mapping_row.unit
  );
end;
$$;

revoke all on function private.service_delete_recipe_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.service_delete_recipe_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb
) to service_role;

create or replace function public.service_delete_recipe_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_delete_recipe_and_signals(
    p_actor_user_id,
    p_restaurant_id,
    p_mapping_id,
    p_expected_revision,
    p_recommendations,
    p_insights
  );
$$;

revoke all on function public.service_delete_recipe_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.service_delete_recipe_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb
) to service_role;

comment on function public.service_delete_recipe_and_signals(
  uuid, uuid, uuid, bigint, jsonb, jsonb
) is
  'Service-owned recipe mapping unlink path. Authenticated clients must call through operational-workflows. Historical inventory movements are retained.';
