-- Make operational guidance server-owned and revision-consistent. Authenticated
-- clients may request workflows through the Edge Function, but only the
-- service role can fetch planning snapshots or commit generated payloads.

create table if not exists private.restaurant_signal_state (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  planning_revision bigint not null default 0 check (planning_revision >= 0),
  signals_revision bigint not null default 0 check (signals_revision >= 0),
  status text not null default 'pending' check (status in ('current', 'pending')),
  updated_at timestamptz not null default now()
);

alter table private.restaurant_signal_state enable row level security;
revoke all on table private.restaurant_signal_state from public, anon, authenticated, service_role;

insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
select restaurant.id, 0, 0, 'current'
from public.restaurants restaurant
on conflict (restaurant_id) do nothing;

alter table public.purchase_recommendations
  add column if not exists generation_source text not null default 'manual',
  add column if not exists planning_revision bigint;
alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_generation_source_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_generation_source_check
  check (generation_source in ('manual', 'mise_rules', 'legacy_client'));
alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_planning_revision_check;
alter table public.purchase_recommendations
  add constraint purchase_recommendations_planning_revision_check
  check (planning_revision is null or planning_revision >= 0);

alter table public.insights
  add column if not exists generation_source text not null default 'mise_rules',
  add column if not exists planning_revision bigint;
alter table public.insights
  drop constraint if exists insights_generation_source_check;
alter table public.insights
  add constraint insights_generation_source_check
  check (generation_source in ('manual', 'mise_rules', 'legacy_client'));
alter table public.insights
  drop constraint if exists insights_planning_revision_check;
alter table public.insights
  add constraint insights_planning_revision_check
  check (planning_revision is null or planning_revision >= 0);

update public.purchase_recommendations
set generation_source = case when status = 'pending' then 'mise_rules' else 'manual' end,
    planning_revision = case when status = 'pending' then 0 else null end;
update public.insights
set generation_source = 'mise_rules', planning_revision = 0;

create or replace function private.actor_has_restaurant_role(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor_user_id is not null and exists (
    select 1
    from public.restaurant_memberships membership
    where membership.user_id = p_actor_user_id
      and membership.restaurant_id = p_restaurant_id
      and membership.status = 'active'
      and membership.role = any(p_allowed_roles)
  );
$$;

create or replace function private.signals_are_current(
  p_restaurant_id uuid,
  p_planning_revision bigint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.restaurant_signal_state signal_state
    where signal_state.restaurant_id = p_restaurant_id
      and signal_state.status = 'current'
      and signal_state.signals_revision = p_planning_revision
  );
$$;

revoke all on function private.actor_has_restaurant_role(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function private.signals_are_current(uuid, bigint) from public, anon;
grant execute on function private.signals_are_current(uuid, bigint) to authenticated;

drop policy if exists "Members can read recommendations" on public.purchase_recommendations;
create policy "Members can read current recommendations"
on public.purchase_recommendations for select to authenticated
using (
  private.is_restaurant_member(restaurant_id)
  and (
    status <> 'pending'
    or generation_source = 'manual'
    or private.signals_are_current(restaurant_id, planning_revision)
  )
);

drop policy if exists "Members can read insights" on public.insights;
create policy "Members can read current insights"
on public.insights for select to authenticated
using (
  private.is_restaurant_member(restaurant_id)
  and (
    generation_source = 'manual'
    or private.signals_are_current(restaurant_id, planning_revision)
  )
);

create or replace function private.bump_restaurant_planning_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid := case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
begin
  insert into private.restaurant_signal_state (
    restaurant_id, planning_revision, signals_revision, status, updated_at
  ) values (
    target_restaurant_id, 1, 0, 'pending', now()
  )
  on conflict (restaurant_id) do update
  set planning_revision = private.restaurant_signal_state.planning_revision + 1,
      status = 'pending',
      updated_at = now();
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.bump_restaurant_planning_revision() from public, anon, authenticated;

drop trigger if exists inventory_items_bump_planning_revision on public.inventory_items;
create trigger inventory_items_bump_planning_revision
after insert or update or delete on public.inventory_items
for each row execute function private.bump_restaurant_planning_revision();

drop trigger if exists pos_sales_bump_planning_revision on public.pos_sales;
create trigger pos_sales_bump_planning_revision
after insert or update or delete on public.pos_sales
for each row execute function private.bump_restaurant_planning_revision();

drop trigger if exists menu_item_ingredients_bump_planning_revision on public.menu_item_ingredients;
create trigger menu_item_ingredients_bump_planning_revision
after insert or update or delete on public.menu_item_ingredients
for each row execute function private.bump_restaurant_planning_revision();

-- The recommendation trigger uses an explicit body because trigger functions
-- cannot invoke another trigger function directly on every PostgreSQL version.
create or replace function private.bump_recommendation_history_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_restaurant_id uuid := case when tg_op = 'DELETE' then old.restaurant_id else new.restaurant_id end;
  should_bump boolean := false;
begin
  if tg_op = 'INSERT' then
    should_bump := new.status in ('approved', 'dismissed', 'ordered');
  elsif tg_op = 'DELETE' then
    should_bump := old.status in ('approved', 'dismissed', 'ordered');
  else
    should_bump := old.status is distinct from new.status
      or (new.status in ('approved', 'ordered') and old.recommended_quantity is distinct from new.recommended_quantity);
  end if;
  if should_bump then
    insert into private.restaurant_signal_state (
      restaurant_id, planning_revision, signals_revision, status, updated_at
    ) values (target_restaurant_id, 1, 0, 'pending', now())
    on conflict (restaurant_id) do update
    set planning_revision = private.restaurant_signal_state.planning_revision + 1,
        status = 'pending',
        updated_at = now();
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.bump_recommendation_history_revision() from public, anon, authenticated;

drop trigger if exists purchase_recommendations_bump_planning_revision on public.purchase_recommendations;
create trigger purchase_recommendations_bump_planning_revision
after insert or update or delete on public.purchase_recommendations
for each row execute function private.bump_recommendation_history_revision();

create or replace function private.fetch_operational_planning_snapshot(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  operating_date date;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending')
  on conflict (restaurant_id) do nothing;
  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id;

  begin
    select timezone(restaurant.timezone, now())::date into operating_date
    from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  exception when invalid_parameter_value then
    operating_date := current_date;
  end;

  return jsonb_build_object(
    'revision', current_revision,
    'restaurantId', p_restaurant_id,
    'operatingDate', coalesce(operating_date, current_date),
    'inventoryItems', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.item_name, item.id)
      from public.inventory_items item where item.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(sale) order by sale.sale_date desc, sale.item_name, sale.id)
      from (
        select * from public.pos_sales
        where restaurant_id = p_restaurant_id
        order by sale_date desc, id
        limit 2000
      ) sale
    ), '[]'::jsonb),
    'menuItemIngredients', coalesce((
      select jsonb_agg(to_jsonb(mapping) order by mapping.menu_item_name, mapping.id)
      from public.menu_item_ingredients mapping where mapping.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'recommendationHistory', coalesce((
      select jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at desc, recommendation.id)
      from (
        select * from public.purchase_recommendations
        where restaurant_id = p_restaurant_id and status <> 'pending'
        order by created_at desc, id
        limit 500
      ) recommendation
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function private.commit_operational_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_expected_revision bigint,
  p_recommendations jsonb,
  p_insights jsonb,
  p_complete_setup boolean default false,
  p_setup_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_revision bigint;
  safe_recommendations jsonb := coalesce(p_recommendations, '[]'::jsonb);
  safe_insights jsonb := coalesce(p_insights, '[]'::jsonb);
  safe_setup_metadata jsonb := coalesce(p_setup_metadata, '{}'::jsonb);
  inserted_recommendations integer;
  inserted_insights integer;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_recommendations) <> 'array'
     or jsonb_typeof(safe_insights) <> 'array'
     or jsonb_array_length(safe_recommendations) > 250
     or jsonb_array_length(safe_insights) > 50 then
    raise exception 'Operational signal payload is outside supported limits' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_setup_metadata) <> 'object' or octet_length(safe_setup_metadata::text) > 8192 then
    raise exception 'Setup metadata must be a bounded object' using errcode = '22023';
  end if;

  select planning_revision into current_revision
  from private.restaurant_signal_state
  where restaurant_id = p_restaurant_id
  for update;
  if not found or current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(safe_recommendations) payload(
      inventory_item_id uuid, recommended_quantity numeric, reason text, urgency text
    )
    left join public.inventory_items item
      on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
    where item.id is null
      or payload.recommended_quantity is null
      or payload.recommended_quantity <= 0
      or payload.recommended_quantity > 1000000
      or payload.urgency not in ('low', 'medium', 'high')
      or length(trim(payload.reason)) not between 1 and 2000
  ) then
    raise exception 'Generated recommendation payload is invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(safe_insights) payload(
      insight_type text, title text, description text, why_it_matters text,
      recommended_action text, severity text
    )
    where payload.insight_type not in ('sales', 'inventory', 'waste', 'cost', 'prep', 'ordering')
      or payload.severity not in ('info', 'warning', 'urgent')
      or length(trim(payload.title)) not between 1 and 240
      or length(trim(payload.description)) not between 1 and 4000
      or length(trim(payload.recommended_action)) not between 1 and 2000
      or (payload.why_it_matters is not null and length(payload.why_it_matters) > 2000)
  ) then
    raise exception 'Generated insight payload is invalid' using errcode = '22023';
  end if;

  delete from public.purchase_recommendations
  where restaurant_id = p_restaurant_id
    and status = 'pending'
    and generation_source in ('mise_rules', 'legacy_client');

  insert into public.purchase_recommendations (
    restaurant_id, inventory_item_id, item_name, supplier_name,
    recommended_quantity, unit, reason, urgency, status, supplier_order_id,
    generation_source, planning_revision
  )
  select
    p_restaurant_id, item.id, item.item_name, item.supplier_name,
    payload.recommended_quantity, item.unit, trim(payload.reason), payload.urgency,
    'pending', null, 'mise_rules', current_revision
  from jsonb_to_recordset(safe_recommendations) payload(
    inventory_item_id uuid, recommended_quantity numeric, reason text, urgency text
  )
  join public.inventory_items item
    on item.restaurant_id = p_restaurant_id and item.id = payload.inventory_item_id
  where not exists (
    select 1 from public.purchase_recommendations manual
    where manual.restaurant_id = p_restaurant_id
      and manual.inventory_item_id = item.id
      and manual.status = 'pending'
      and manual.generation_source = 'manual'
  );
  get diagnostics inserted_recommendations = row_count;

  delete from public.insights where restaurant_id = p_restaurant_id;
  insert into public.insights (
    restaurant_id, insight_type, title, description, why_it_matters,
    recommended_action, severity, generation_source, planning_revision
  )
  select
    p_restaurant_id, payload.insight_type, trim(payload.title), trim(payload.description),
    nullif(trim(payload.why_it_matters), ''), trim(payload.recommended_action), payload.severity,
    'mise_rules', current_revision
  from jsonb_to_recordset(safe_insights) payload(
    insight_type text, title text, description text, why_it_matters text,
    recommended_action text, severity text
  );
  get diagnostics inserted_insights = row_count;

  update private.restaurant_signal_state
  set signals_revision = current_revision, status = 'current', updated_at = now()
  where restaurant_id = p_restaurant_id;

  if p_complete_setup and not exists (
    select 1 from public.audit_logs audit
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'setup_completed'
      and audit.metadata->>'setup_fingerprint' = safe_setup_metadata->>'setup_fingerprint'
  ) then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, p_actor_user_id, 'setup_completed', 'restaurants', p_restaurant_id,
      safe_setup_metadata || jsonb_build_object('signals_revision', current_revision)
    );
  end if;

  return jsonb_build_object(
    'planning_revision', current_revision,
    'signals_status', 'current',
    'recommendations', inserted_recommendations,
    'insights', inserted_insights
  );
end;
$$;

create or replace function private.mark_operational_signals_pending(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare current_revision bigint;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  insert into private.restaurant_signal_state (restaurant_id, planning_revision, signals_revision, status)
  values (p_restaurant_id, 0, 0, 'pending')
  on conflict (restaurant_id) do update set status = 'pending', updated_at = now()
  returning planning_revision into current_revision;
  return current_revision;
end;
$$;

create or replace function private.service_update_inventory_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_inventory_item_id uuid,
  p_expected_revision bigint,
  p_patch jsonb,
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
  safe_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  item_row public.inventory_items%rowtype;
begin
  if not private.actor_has_restaurant_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then raise exception 'Not authorized for this restaurant' using errcode = '42501'; end if;
  select planning_revision into current_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id for update;
  if current_revision is distinct from p_expected_revision then
    raise exception 'Planning snapshot changed; retry from a fresh snapshot' using errcode = '40001';
  end if;
  if jsonb_typeof(safe_patch) <> 'object' or safe_patch = '{}'::jsonb
     or safe_patch - array['current_quantity', 'par_level', 'reorder_threshold', 'supplier_name'] <> '{}'::jsonb then
    raise exception 'Inventory patch contains unsupported fields' using errcode = '22023';
  end if;
  select * into item_row from public.inventory_items
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id for update;
  if not found then raise exception 'Inventory item not found'; end if;
  item_row.current_quantity := case when safe_patch ? 'current_quantity' then (safe_patch->>'current_quantity')::numeric else item_row.current_quantity end;
  item_row.par_level := case when safe_patch ? 'par_level' then (safe_patch->>'par_level')::numeric else item_row.par_level end;
  item_row.reorder_threshold := case when safe_patch ? 'reorder_threshold' then (safe_patch->>'reorder_threshold')::numeric else item_row.reorder_threshold end;
  item_row.supplier_name := case when safe_patch ? 'supplier_name' then trim(safe_patch->>'supplier_name') else item_row.supplier_name end;
  if item_row.current_quantity not between 0 and 1000000
     or item_row.par_level not between 0 and 1000000
     or item_row.reorder_threshold not between 0 and 1000000
     or length(item_row.supplier_name) not between 1 and 160 then
    raise exception 'Inventory patch is outside supported limits' using errcode = '22023';
  end if;
  update public.inventory_items
  set current_quantity = item_row.current_quantity,
      par_level = item_row.par_level,
      reorder_threshold = item_row.reorder_threshold,
      supplier_name = item_row.supplier_name,
      last_updated = clock_timestamp()
  where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  returning * into item_row;
  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );
  return to_jsonb(item_row);
end;
$$;

create or replace function private.service_save_recipe_and_signals(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_mapping_id uuid,
  p_menu_item_name text,
  p_inventory_item_id uuid,
  p_quantity_used_per_sale numeric,
  p_unit text,
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
  p_menu_item_name := trim(p_menu_item_name);
  p_unit := trim(p_unit);
  if length(p_menu_item_name) not between 1 and 200
     or length(p_unit) not between 1 and 40
     or p_quantity_used_per_sale is null
     or p_quantity_used_per_sale <= 0
     or p_quantity_used_per_sale > 10000 then
    raise exception 'Recipe mapping is outside supported limits' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.inventory_items
    where restaurant_id = p_restaurant_id and id = p_inventory_item_id
  ) then raise exception 'Inventory item not found'; end if;
  if p_mapping_id is null then
    insert into public.menu_item_ingredients (
      restaurant_id, menu_item_name, inventory_item_id, quantity_used_per_sale, unit
    ) values (
      p_restaurant_id, p_menu_item_name, p_inventory_item_id, p_quantity_used_per_sale, p_unit
    )
    on conflict (restaurant_id, menu_item_name, inventory_item_id) do update
    set quantity_used_per_sale = excluded.quantity_used_per_sale, unit = excluded.unit
    returning * into mapping_row;
  else
    update public.menu_item_ingredients
    set menu_item_name = p_menu_item_name,
        quantity_used_per_sale = p_quantity_used_per_sale,
        unit = p_unit
    where restaurant_id = p_restaurant_id
      and id = p_mapping_id
      and inventory_item_id = p_inventory_item_id
    returning * into mapping_row;
    if not found then raise exception 'Recipe mapping not found'; end if;
  end if;
  select planning_revision into commit_revision
  from private.restaurant_signal_state where restaurant_id = p_restaurant_id;
  perform private.commit_operational_signals(
    p_actor_user_id, p_restaurant_id, commit_revision, p_recommendations, p_insights, false, '{}'::jsonb
  );
  return to_jsonb(mapping_row);
end;
$$;

revoke all on function private.fetch_operational_planning_snapshot(uuid, uuid) from public, anon, authenticated;
revoke all on function private.commit_operational_signals(uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
revoke all on function private.mark_operational_signals_pending(uuid, uuid) from public, anon, authenticated;
revoke all on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.service_save_recipe_and_signals(uuid, uuid, uuid, text, uuid, numeric, text, bigint, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.service_fetch_operational_planning_snapshot(
  p_actor_user_id uuid, p_restaurant_id uuid
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.fetch_operational_planning_snapshot(p_actor_user_id, p_restaurant_id); $$;

create or replace function public.service_commit_operational_signals(
  p_actor_user_id uuid, p_restaurant_id uuid, p_expected_revision bigint,
  p_recommendations jsonb, p_insights jsonb, p_complete_setup boolean default false,
  p_setup_metadata jsonb default '{}'::jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.commit_operational_signals(
  p_actor_user_id, p_restaurant_id, p_expected_revision, p_recommendations,
  p_insights, p_complete_setup, p_setup_metadata
); $$;

create or replace function public.service_mark_operational_signals_pending(
  p_actor_user_id uuid, p_restaurant_id uuid
)
returns bigint language sql security invoker set search_path = ''
as $$ select private.mark_operational_signals_pending(p_actor_user_id, p_restaurant_id); $$;

create or replace function public.service_update_inventory_and_signals(
  p_actor_user_id uuid, p_restaurant_id uuid, p_inventory_item_id uuid,
  p_expected_revision bigint, p_patch jsonb, p_recommendations jsonb, p_insights jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.service_update_inventory_and_signals(
  p_actor_user_id, p_restaurant_id, p_inventory_item_id, p_expected_revision,
  p_patch, p_recommendations, p_insights
); $$;

create or replace function public.service_save_recipe_and_signals(
  p_actor_user_id uuid, p_restaurant_id uuid, p_mapping_id uuid,
  p_menu_item_name text, p_inventory_item_id uuid, p_quantity_used_per_sale numeric,
  p_unit text, p_expected_revision bigint, p_recommendations jsonb, p_insights jsonb
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.service_save_recipe_and_signals(
  p_actor_user_id, p_restaurant_id, p_mapping_id, p_menu_item_name,
  p_inventory_item_id, p_quantity_used_per_sale, p_unit, p_expected_revision,
  p_recommendations, p_insights
); $$;

revoke all on function public.service_fetch_operational_planning_snapshot(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_commit_operational_signals(uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_mark_operational_signals_pending(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_save_recipe_and_signals(uuid, uuid, uuid, text, uuid, numeric, text, bigint, jsonb, jsonb) from public, anon, authenticated, service_role;
grant usage on schema private to service_role;
grant execute on function private.fetch_operational_planning_snapshot(uuid, uuid) to service_role;
grant execute on function private.commit_operational_signals(uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb) to service_role;
grant execute on function private.mark_operational_signals_pending(uuid, uuid) to service_role;
grant execute on function private.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) to service_role;
grant execute on function private.service_save_recipe_and_signals(uuid, uuid, uuid, text, uuid, numeric, text, bigint, jsonb, jsonb) to service_role;
grant execute on function public.service_fetch_operational_planning_snapshot(uuid, uuid) to service_role;
grant execute on function public.service_commit_operational_signals(uuid, uuid, bigint, jsonb, jsonb, boolean, jsonb) to service_role;
grant execute on function public.service_mark_operational_signals_pending(uuid, uuid) to service_role;
grant execute on function public.service_update_inventory_and_signals(uuid, uuid, uuid, bigint, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.service_save_recipe_and_signals(uuid, uuid, uuid, text, uuid, numeric, text, bigint, jsonb, jsonb) to service_role;

-- Client-supplied generated payload surfaces are obsolete. Only the Edge
-- service workflow may commit operational guidance.
revoke all on function public.replace_pending_purchase_recommendations(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.replace_operational_insights(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.replace_operational_signals(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.update_inventory_item_and_signals(uuid, uuid, timestamptz, jsonb, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.save_recipe_mapping_and_signals(uuid, uuid, text, uuid, numeric, text, numeric, jsonb, jsonb) from public, anon, authenticated, service_role;

-- Register the new Edge workflow with the existing private firewall.
alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
      'send-supplier-email', 'operational-workflows'
    )
  );

create or replace function private.edge_function_policy(p_function_name text)
returns table (max_attempts integer, window_seconds integer, allowed_roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select policy.max_attempts, policy.window_seconds, policy.allowed_roles
  from (
    values
      ('sync-pos-sales', 8, 60, array['owner', 'admin', 'manager']::text[]),
      ('generate-ai-insights', 6, 300, array['owner', 'admin', 'manager']::text[]),
      ('link-gmail', 4, 300, array['owner', 'admin']::text[]),
      ('send-supplier-email', 12, 60, array['owner', 'admin', 'manager']::text[]),
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager']::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated;
