-- Close deferred profile/AI authority paths and keep supplier message assembly
-- bounded before the final 64 KiB output truncation.

create or replace function private.restaurant_operational_profile_is_valid(p_profile jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  array_key text;
  array_entry jsonb;
begin
  if p_profile is null
    or pg_catalog.jsonb_typeof(p_profile) <> 'object'
    or pg_catalog.octet_length(p_profile::text) > 16384
    or p_profile - array[
      'serviceStyle', 'orderCadence', 'prepWindows',
      'primarySuppliers', 'inventoryReviewDays', 'notes'
    ] <> '{}'::jsonb
  then
    return false;
  end if;

  if p_profile ? 'serviceStyle' and (
    pg_catalog.jsonb_typeof(p_profile -> 'serviceStyle') <> 'string'
    or p_profile ->> 'serviceStyle' not in (
      'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'
    )
  ) then
    return false;
  end if;

  foreach array_key in array array[
    'orderCadence', 'prepWindows', 'primarySuppliers', 'inventoryReviewDays'
  ] loop
    if p_profile ? array_key then
      if pg_catalog.jsonb_typeof(p_profile -> array_key) <> 'array'
        or pg_catalog.jsonb_array_length(p_profile -> array_key) > 20
      then
        return false;
      end if;
      for array_entry in
        select element.value
        from pg_catalog.jsonb_array_elements(p_profile -> array_key) element(value)
      loop
        if pg_catalog.jsonb_typeof(array_entry) <> 'string'
          or pg_catalog.length(array_entry #>> '{}') not between 1 and 160
        then
          return false;
        end if;
      end loop;
    end if;
  end loop;

  if p_profile ? 'notes'
    and p_profile -> 'notes' <> 'null'::jsonb
    and (
      pg_catalog.jsonb_typeof(p_profile -> 'notes') <> 'string'
      or pg_catalog.length(p_profile ->> 'notes') > 2000
    )
  then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function private.restaurant_operational_profile_is_valid(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.restaurant_operational_profile_is_valid(jsonb) to service_role;

alter table public.restaurants drop constraint if exists restaurants_address_length_check;
alter table public.restaurants add constraint restaurants_address_length_check
  check (address is null or pg_catalog.length(address) <= 500);
alter table public.restaurants drop constraint if exists restaurants_cuisine_type_length_check;
alter table public.restaurants add constraint restaurants_cuisine_type_length_check
  check (cuisine_type is null or pg_catalog.length(cuisine_type) <= 120);
alter table public.restaurants drop constraint if exists restaurants_logo_url_check;
alter table public.restaurants add constraint restaurants_logo_url_check
  check (
    logo_url is null or (
      pg_catalog.length(logo_url) <= 2048
      and logo_url ~* '^https://([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    )
  );
alter table public.restaurants drop constraint if exists restaurants_timezone_length_check;
alter table public.restaurants add constraint restaurants_timezone_length_check
  check (pg_catalog.length(timezone) between 1 and 64);
alter table public.restaurants drop constraint if exists restaurants_currency_code_check;
alter table public.restaurants add constraint restaurants_currency_code_check
  check (currency ~ '^[A-Z]{3}$');
alter table public.restaurants drop constraint if exists restaurants_operational_profile_bounds_check;
alter table public.restaurants add constraint restaurants_operational_profile_bounds_check
  check (private.restaurant_operational_profile_is_valid(operational_profile));

create or replace function private.update_restaurant_profile(
  p_restaurant_id uuid,
  p_patch jsonb
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_restaurant public.restaurants;
  updated_restaurant public.restaurants;
  next_name text;
  next_address text;
  next_cuisine_type text;
  next_brand_color text;
  next_accent_color text;
  next_logo_url text;
  next_service_style text;
  next_timezone text;
  next_currency text;
  next_operational_profile jsonb;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null
    or p_patch is null
    or pg_catalog.jsonb_typeof(p_patch) <> 'object'
    or p_patch = '{}'::jsonb
    or pg_catalog.octet_length(p_patch::text) > 32768
    or p_patch - array[
      'name', 'address', 'cuisine_type', 'brand_color', 'accent_color',
      'logo_url', 'service_style', 'timezone', 'currency', 'operational_profile'
    ] <> '{}'::jsonb
  then
    raise exception 'Restaurant profile patch is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) then
    raise exception 'Restaurant profile access denied' using errcode = '42501';
  end if;

  select * into current_restaurant
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id
  for update;
  if not found then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  next_name := current_restaurant.name;
  next_address := current_restaurant.address;
  next_cuisine_type := current_restaurant.cuisine_type;
  next_brand_color := current_restaurant.brand_color;
  next_accent_color := current_restaurant.accent_color;
  next_logo_url := current_restaurant.logo_url;
  next_service_style := current_restaurant.service_style;
  next_timezone := current_restaurant.timezone;
  next_currency := current_restaurant.currency;
  next_operational_profile := current_restaurant.operational_profile;

  if p_patch ? 'name' then
    if pg_catalog.jsonb_typeof(p_patch -> 'name') <> 'string' then
      raise exception 'Restaurant name must be text' using errcode = '22023';
    end if;
    next_name := pg_catalog.btrim(p_patch ->> 'name');
    if pg_catalog.length(next_name) not between 1 and 120 then
      raise exception 'Restaurant name must be between 1 and 120 characters' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'address' then
    if p_patch -> 'address' = 'null'::jsonb then
      next_address := null;
    elsif pg_catalog.jsonb_typeof(p_patch -> 'address') = 'string' then
      next_address := nullif(pg_catalog.btrim(p_patch ->> 'address'), '');
      if pg_catalog.length(next_address) > 500 then
        raise exception 'Restaurant address must not exceed 500 characters' using errcode = '22023';
      end if;
    else
      raise exception 'Restaurant address must be text or null' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'cuisine_type' then
    if p_patch -> 'cuisine_type' = 'null'::jsonb then
      next_cuisine_type := null;
    elsif pg_catalog.jsonb_typeof(p_patch -> 'cuisine_type') = 'string' then
      next_cuisine_type := nullif(pg_catalog.btrim(p_patch ->> 'cuisine_type'), '');
      if pg_catalog.length(next_cuisine_type) > 120 then
        raise exception 'Cuisine type must not exceed 120 characters' using errcode = '22023';
      end if;
    else
      raise exception 'Cuisine type must be text or null' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'brand_color' then
    if pg_catalog.jsonb_typeof(p_patch -> 'brand_color') <> 'string'
      or p_patch ->> 'brand_color' !~ '^#[0-9A-Fa-f]{6}$'
    then
      raise exception 'Brand color must be a six-digit hex color' using errcode = '22023';
    end if;
    next_brand_color := p_patch ->> 'brand_color';
  end if;
  if p_patch ? 'accent_color' then
    if pg_catalog.jsonb_typeof(p_patch -> 'accent_color') <> 'string'
      or p_patch ->> 'accent_color' !~ '^#[0-9A-Fa-f]{6}$'
    then
      raise exception 'Accent color must be a six-digit hex color' using errcode = '22023';
    end if;
    next_accent_color := p_patch ->> 'accent_color';
  end if;

  if p_patch ? 'logo_url' then
    if p_patch -> 'logo_url' = 'null'::jsonb then
      next_logo_url := null;
    elsif pg_catalog.jsonb_typeof(p_patch -> 'logo_url') = 'string' then
      next_logo_url := nullif(pg_catalog.btrim(p_patch ->> 'logo_url'), '');
      if next_logo_url is not null and (
        pg_catalog.length(next_logo_url) > 2048
        or next_logo_url !~* '^https://([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
      ) then
        raise exception 'Logo URL must be an HTTPS URL of at most 2048 characters' using errcode = '22023';
      end if;
    else
      raise exception 'Logo URL must be text or null' using errcode = '22023';
    end if;
  end if;

  if p_patch ? 'service_style' then
    if pg_catalog.jsonb_typeof(p_patch -> 'service_style') <> 'string'
      or p_patch ->> 'service_style' not in (
        'quick_service', 'fast_casual', 'full_service', 'bar', 'cafe', 'ghost_kitchen'
      )
    then
      raise exception 'Service style is invalid' using errcode = '22023';
    end if;
    next_service_style := p_patch ->> 'service_style';
  end if;

  if p_patch ? 'timezone' then
    if pg_catalog.jsonb_typeof(p_patch -> 'timezone') <> 'string'
      or pg_catalog.length(p_patch ->> 'timezone') not between 1 and 64
      or not exists (
        select 1 from pg_catalog.pg_timezone_names timezone_row
        where timezone_row.name = p_patch ->> 'timezone'
      )
    then
      raise exception 'Timezone must be a supported IANA timezone' using errcode = '22023';
    end if;
    next_timezone := p_patch ->> 'timezone';
  end if;

  if p_patch ? 'currency' then
    if pg_catalog.jsonb_typeof(p_patch -> 'currency') <> 'string'
      or p_patch ->> 'currency' !~ '^[A-Z]{3}$'
    then
      raise exception 'Currency must be a three-letter uppercase code' using errcode = '22023';
    end if;
    next_currency := p_patch ->> 'currency';
  end if;

  if p_patch ? 'operational_profile' then
    next_operational_profile := p_patch -> 'operational_profile';
    if not private.restaurant_operational_profile_is_valid(next_operational_profile) then
      raise exception 'Operational profile is invalid or exceeds its limits' using errcode = '22023';
    end if;
    if next_operational_profile ? 'serviceStyle' then
      if p_patch ? 'service_style'
        and next_operational_profile ->> 'serviceStyle' <> next_service_style
      then
        raise exception 'Profile service style must match the restaurant service style' using errcode = '22023';
      end if;
      next_service_style := next_operational_profile ->> 'serviceStyle';
    end if;
  end if;
  if p_patch ? 'service_style' then
    next_operational_profile := pg_catalog.jsonb_set(
      next_operational_profile,
      '{serviceStyle}',
      pg_catalog.to_jsonb(next_service_style),
      true
    );
  end if;
  if not private.restaurant_operational_profile_is_valid(next_operational_profile) then
    raise exception 'Operational profile is invalid or exceeds its limits' using errcode = '22023';
  end if;

  update public.restaurants restaurant
  set name = next_name,
      address = next_address,
      cuisine_type = next_cuisine_type,
      brand_color = next_brand_color,
      accent_color = next_accent_color,
      logo_url = next_logo_url,
      service_style = next_service_style,
      timezone = next_timezone,
      currency = next_currency,
      operational_profile = next_operational_profile
  where restaurant.id = p_restaurant_id
  returning * into updated_restaurant;
  return updated_restaurant;
end;
$$;

create or replace function public.update_restaurant_profile(
  p_restaurant_id uuid,
  p_patch jsonb
)
returns public.restaurants
language sql
security invoker
set search_path = ''
as $$ select private.update_restaurant_profile(p_restaurant_id, p_patch); $$;

revoke all on function private.update_restaurant_profile(uuid, jsonb) from public, anon;
revoke all on function public.update_restaurant_profile(uuid, jsonb) from public, anon;
grant execute on function private.update_restaurant_profile(uuid, jsonb) to authenticated;
grant execute on function public.update_restaurant_profile(uuid, jsonb) to authenticated;
revoke update on public.restaurants from authenticated;
drop policy if exists "Owners and admins can update restaurant profile" on public.restaurants;

create or replace function private.structured_ai_insight_output_is_valid(p_output jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  evidence_entry jsonb;
  confidence_value numeric;
begin
  if p_output is null
    or pg_catalog.jsonb_typeof(p_output) <> 'object'
    or pg_catalog.octet_length(p_output::text) > 16384
    or not (p_output ?& array[
      'title', 'summary', 'recommended_action', 'risk_level',
      'confidence', 'affected_workflow', 'evidence'
    ])
    or p_output - array[
      'title', 'summary', 'recommended_action', 'risk_level',
      'confidence', 'affected_workflow', 'evidence'
    ] <> '{}'::jsonb
    or pg_catalog.jsonb_typeof(p_output -> 'title') <> 'string'
    or pg_catalog.length(p_output ->> 'title') not between 1 and 96
    or pg_catalog.jsonb_typeof(p_output -> 'summary') <> 'string'
    or pg_catalog.length(p_output ->> 'summary') not between 1 and 500
    or pg_catalog.jsonb_typeof(p_output -> 'recommended_action') <> 'string'
    or pg_catalog.length(p_output ->> 'recommended_action') not between 1 and 240
    or pg_catalog.jsonb_typeof(p_output -> 'risk_level') <> 'string'
    or p_output ->> 'risk_level' not in ('low', 'medium', 'high')
    or pg_catalog.jsonb_typeof(p_output -> 'affected_workflow') <> 'string'
    or p_output ->> 'affected_workflow' not in ('inventory', 'ordering', 'prep', 'sales', 'waste', 'cost')
    or pg_catalog.jsonb_typeof(p_output -> 'confidence') <> 'number'
    or pg_catalog.jsonb_typeof(p_output -> 'evidence') <> 'array'
    or pg_catalog.jsonb_array_length(p_output -> 'evidence') > 6
  then
    return false;
  end if;

  begin
    confidence_value := (p_output ->> 'confidence')::numeric;
  exception when others then
    return false;
  end;
  if confidence_value < 0 or confidence_value > 1 then return false; end if;

  for evidence_entry in
    select element.value
    from pg_catalog.jsonb_array_elements(p_output -> 'evidence') element(value)
  loop
    if pg_catalog.jsonb_typeof(evidence_entry) <> 'string'
      or pg_catalog.length(evidence_entry #>> '{}') not between 1 and 180
    then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.structured_ai_insight_output_is_valid(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.structured_ai_insight_output_is_valid(jsonb) to service_role;

-- Preserve legacy rows while converting their previously loose JSON into the
-- bounded v1 shape. No row retains an unverified OpenAI provenance claim.
update public.ai_insights insight
set output = pg_catalog.jsonb_build_object(
      'title', pg_catalog.left(coalesce(nullif(insight.output ->> 'title', ''), 'Legacy insight'), 96),
      'summary', pg_catalog.left(coalesce(nullif(insight.output ->> 'summary', ''), 'Review the migrated insight.'), 500),
      'recommended_action', pg_catalog.left(
        coalesce(nullif(insight.output ->> 'recommended_action', ''), 'Review this insight before taking action.'),
        240
      ),
      'risk_level', insight.risk_level,
      'confidence', insight.confidence,
      'affected_workflow', case
        when insight.output ->> 'affected_workflow' in ('inventory', 'ordering', 'prep', 'sales', 'waste', 'cost')
          then insight.output ->> 'affected_workflow'
        else 'inventory'
      end,
      'evidence', pg_catalog.jsonb_build_array('Migrated from a legacy structured insight row.')
    );

update public.ai_insights
set source = 'rules_engine',
    generated_by = case
      when source = 'rules_engine' and generated_by in ('edge_function_scaffold', 'mise_rules', 'staging_seed')
        then generated_by
      else 'legacy_unverified'
    end
where source <> 'rules_engine'
   or generated_by is null
   or generated_by not in ('edge_function_scaffold', 'mise_rules', 'staging_seed', 'legacy_unverified');

alter table public.ai_insights drop constraint if exists ai_insights_output_bounds_check;
alter table public.ai_insights add constraint ai_insights_output_bounds_check
  check (private.structured_ai_insight_output_is_valid(output));
alter table public.ai_insights drop constraint if exists ai_insights_schema_version_length_check;
alter table public.ai_insights add constraint ai_insights_schema_version_length_check
  check (pg_catalog.length(schema_version) between 1 and 80);
alter table public.ai_insights drop constraint if exists ai_insights_server_provenance_check;
alter table public.ai_insights add constraint ai_insights_server_provenance_check
  check (
    source = 'rules_engine'
    and generated_by in ('edge_function_scaffold', 'mise_rules', 'staging_seed', 'legacy_unverified')
  );

create or replace function private.service_create_rules_engine_ai_insight(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_output jsonb
)
returns public.ai_insights
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_insight public.ai_insights;
begin
  if p_actor_user_id is null or p_restaurant_id is null then
    raise exception 'Missing AI insight authority' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.restaurant_memberships membership
    where membership.restaurant_id = p_restaurant_id
      and membership.user_id = p_actor_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin', 'manager')
  ) then
    raise exception 'AI insight access denied' using errcode = '42501';
  end if;
  if not private.structured_ai_insight_output_is_valid(p_output) then
    raise exception 'Structured AI insight output is invalid' using errcode = '22023';
  end if;

  insert into public.ai_insights (
    restaurant_id, source, schema_version, output, risk_level,
    confidence, status, generated_by
  ) values (
    p_restaurant_id,
    'rules_engine',
    'mise.ai_insight.v1',
    p_output,
    p_output ->> 'risk_level',
    (p_output ->> 'confidence')::numeric,
    'generated',
    'edge_function_scaffold'
  ) returning * into created_insight;
  return created_insight;
end;
$$;

create or replace function public.service_create_rules_engine_ai_insight(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_output jsonb
)
returns public.ai_insights
language sql
security invoker
set search_path = ''
as $$ select private.service_create_rules_engine_ai_insight(p_actor_user_id, p_restaurant_id, p_output); $$;

revoke all on function private.service_create_rules_engine_ai_insight(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_create_rules_engine_ai_insight(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
grant execute on function private.service_create_rules_engine_ai_insight(uuid, uuid, jsonb) to service_role;
grant execute on function public.service_create_rules_engine_ai_insight(uuid, uuid, jsonb) to service_role;

revoke insert, update, delete on public.ai_insights from authenticated;
grant select on public.ai_insights to authenticated;
drop policy if exists "Managers can insert ai insights" on public.ai_insights;
drop policy if exists "Managers can update ai insights" on public.ai_insights;
drop policy if exists "Owners and admins can delete ai insights" on public.ai_insights;

create or replace function private.build_supplier_order_message(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_supplier_name text,
  p_operator_note text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  with bounded_recommendations as (
    select
      pg_catalog.left(recommendation.item_name, 200) as item_name,
      recommendation.recommended_quantity,
      pg_catalog.left(recommendation.unit, 40) as unit,
      recommendation.id
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
    order by recommendation.item_name, recommendation.id
    limit 1000
  ), generated_lines as (
    select pg_catalog.string_agg(
      recommendation.item_name || ' - ' || recommendation.recommended_quantity::text || ' ' || recommendation.unit,
      E'\n' order by recommendation.item_name, recommendation.id
    ) as body
    from bounded_recommendations recommendation
  )
  select private.truncate_utf8(
    'Order draft for ' || pg_catalog.left(p_supplier_name, 160) || E'\n\n' || coalesce(generated_lines.body, '') ||
    E'\n\nDelivery requested: Tomorrow morning' ||
    case when nullif(pg_catalog.btrim(p_operator_note), '') is null then ''
      else E'\n\nNotes:\n' || pg_catalog.left(pg_catalog.btrim(p_operator_note), 2000) end,
    65536
  )
  from generated_lines;
$$;

revoke all on function private.build_supplier_order_message(uuid, uuid, text, text) from public, anon, authenticated;
