-- Route restaurant profile, operator display-name, and preferred-locale writes
-- through service-owned RPCs so authenticated Expo clients must use
-- operational-workflows (Edge firewall reservation + audit). Locale reads stay
-- identity-free via get_my_preferred_locale. Preference row identity always
-- comes from the Edge-authenticated actor, never from a client-selected user id.

-- Replace auth.uid()-bound private profile updater with an explicit actor form.
-- Drop the public wrapper first so the private signature change is not blocked.
revoke all on function public.update_restaurant_profile(uuid, jsonb)
  from public, anon, authenticated, service_role;
drop function if exists public.update_restaurant_profile(uuid, jsonb);
revoke all on function private.update_restaurant_profile(uuid, jsonb)
  from public, anon, authenticated, service_role;
drop function if exists private.update_restaurant_profile(uuid, jsonb);

create or replace function private.update_restaurant_profile(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := p_actor_user_id;
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

revoke all on function private.update_restaurant_profile(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.update_restaurant_profile(uuid, uuid, jsonb)
  to service_role;

create or replace function public.update_restaurant_profile(
  p_restaurant_id uuid,
  p_patch jsonb
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.update_restaurant_profile(auth.uid(), p_restaurant_id, p_patch);
end;
$$;

revoke all on function public.update_restaurant_profile(uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.service_update_restaurant_profile(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_patch jsonb
)
returns public.restaurants
language sql
security invoker
set search_path = ''
as $$
  select private.update_restaurant_profile(
    p_actor_user_id,
    p_restaurant_id,
    p_patch
  );
$$;

revoke all on function public.service_update_restaurant_profile(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_restaurant_profile(uuid, uuid, jsonb)
  to service_role;

comment on function public.service_update_restaurant_profile(uuid, uuid, jsonb) is
  'Service-owned restaurant profile update. Authenticated clients must call through operational-workflows.';

create or replace function private.service_update_my_profile(
  p_actor_user_id uuid,
  p_name text
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_email text;
  normalized_name text := pg_catalog.btrim(p_name);
  updated_user public.users;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_name is null or pg_catalog.length(normalized_name) not between 1 and 120 then
    raise exception 'Profile name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  select auth_user.email into actor_email
  from auth.users auth_user
  where auth_user.id = p_actor_user_id;
  if actor_email is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  insert into public.users (id, restaurant_id, name, email, role)
  values (p_actor_user_id, null, normalized_name, actor_email, 'staff')
  on conflict (id) do update
    set name = excluded.name
  returning * into updated_user;
  return updated_user;
end;
$$;

revoke all on function private.service_update_my_profile(uuid, text)
  from public, anon, authenticated;
grant execute on function private.service_update_my_profile(uuid, text)
  to service_role;

create or replace function public.service_update_my_profile(
  p_actor_user_id uuid,
  p_name text
)
returns public.users
language sql
security invoker
set search_path = ''
as $$
  select private.service_update_my_profile(p_actor_user_id, p_name);
$$;

revoke all on function public.service_update_my_profile(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_my_profile(uuid, text)
  to service_role;

comment on function public.service_update_my_profile(uuid, text) is
  'Service-owned operator display-name update. Authenticated clients must call through operational-workflows.';

-- Keep the auth.uid()-bound RPC for SQL callers, but revoke Data API execute.
create or replace function public.update_my_profile(p_name text)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_update_my_profile(auth.uid(), p_name);
end;
$$;

revoke all on function public.update_my_profile(text)
  from public, anon, authenticated, service_role;

create or replace function private.service_update_my_preferred_locale(
  p_actor_user_id uuid,
  p_locale text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_locale text;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_locale is null or p_locale not in ('en', 'es', 'zh-Hans') then
    raise exception 'Preferred locale is not supported' using errcode = '22023';
  end if;

  update public.users profile
  set preferred_locale = p_locale
  where profile.id = p_actor_user_id
  returning profile.preferred_locale into updated_locale;

  if updated_locale is null then
    raise exception 'Authenticated profile is unavailable' using errcode = 'P0002';
  end if;

  return updated_locale;
end;
$$;

revoke all on function private.service_update_my_preferred_locale(uuid, text)
  from public, anon, authenticated;
grant execute on function private.service_update_my_preferred_locale(uuid, text)
  to service_role;

create or replace function public.service_update_my_preferred_locale(
  p_actor_user_id uuid,
  p_locale text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.service_update_my_preferred_locale(p_actor_user_id, p_locale);
$$;

revoke all on function public.service_update_my_preferred_locale(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_update_my_preferred_locale(uuid, text)
  to service_role;

comment on function public.service_update_my_preferred_locale(uuid, text) is
  'Service-owned operator locale update. Authenticated clients must call through operational-workflows with an active restaurant membership for Edge reservation; the preference row is always the Edge-authenticated actor.';

create or replace function public.update_my_preferred_locale(p_locale text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return private.service_update_my_preferred_locale(auth.uid(), p_locale);
end;
$$;

revoke all on function public.update_my_preferred_locale(text)
  from public, anon, authenticated, service_role;
