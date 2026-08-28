-- Allow owners/admins to authorize (active) or pause Square POS locations.
-- Sync and planning already filter location.status = 'active'. Authenticated
-- Data API remains SELECT-only on pos_locations; status changes go through this
-- guarded RPC. OAuth reconnect preserves an operator pause instead of
-- force-reactivating every known location.

create or replace function private.service_complete_square_oauth(
  p_flow_id uuid,
  p_merchant_id text,
  p_external_location_id text,
  p_credential_material text,
  p_granted_scopes text[],
  p_locations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.square_oauth_flows%rowtype;
  old_credential private.square_credentials%rowtype;
  new_secret_id uuid;
  integration_id uuid;
  location_row jsonb;
begin
  select * into flow from private.square_oauth_flows where id = p_flow_id for update;
  if not found or flow.claimed_at is null or flow.completed_at is not null or flow.failed_at is not null
    or flow.expires_at <= now()
  then
    raise exception 'OAuth flow cannot be completed' using errcode = '22023';
  end if;
  if not private.gmail_service_actor_has_role(
    flow.actor_user_id, flow.restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Square connection access denied' using errcode = '42501';
  end if;
  if p_merchant_id is null or length(p_merchant_id) not between 1 and 128
    or p_credential_material is null or length(p_credential_material) not between 8 and 4096
    or p_granted_scopes is null
    or cardinality(p_granted_scopes) not between 1 and 20
    or 'ORDERS_READ' <> all(p_granted_scopes)
    or 'ITEMS_READ' <> all(p_granted_scopes)
    or 'MERCHANT_PROFILE_READ' <> all(p_granted_scopes)
    or p_locations is null or jsonb_typeof(p_locations) <> 'array'
  then
    raise exception 'OAuth credential response is invalid' using errcode = '22023';
  end if;

  insert into public.pos_integrations (
    restaurant_id, provider, status, external_location_id, last_sync_at, sync_cursor, settings
  ) values (
    flow.restaurant_id, 'square', 'connected',
    nullif(trim(coalesce(p_external_location_id, '')), ''),
    null, null, '{}'::jsonb
  )
  on conflict (restaurant_id, provider) do update set
    status = 'connected',
    external_location_id = excluded.external_location_id,
    updated_at = now()
  returning id into integration_id;

  for location_row in
    select value from jsonb_array_elements(p_locations)
  loop
    if coalesce(location_row->>'external_location_id', '') = ''
      or coalesce(location_row->>'display_name', '') = ''
    then
      continue;
    end if;
    insert into public.pos_locations (
      restaurant_id, pos_integration_id, external_location_id, display_name, timezone, status
    ) values (
      flow.restaurant_id,
      integration_id,
      left(location_row->>'external_location_id', 128),
      left(location_row->>'display_name', 200),
      nullif(left(coalesce(location_row->>'timezone', ''), 64), ''),
      'active'
    )
    on conflict (restaurant_id, pos_integration_id, external_location_id) do update set
      display_name = excluded.display_name,
      timezone = excluded.timezone,
      -- Preserve operator pause across reconnect; restore disconnected → active.
      status = case
        when public.pos_locations.status = 'paused' then 'paused'
        else 'active'
      end,
      updated_at = now();
  end loop;

  select * into old_credential
  from private.square_credentials
  where restaurant_id = flow.restaurant_id
  for update;

  new_secret_id := vault.create_secret(
    p_credential_material,
    'mise-square-refresh-' || flow.restaurant_id::text || '-' || gen_random_uuid()::text,
    'Mise Square refresh credential; backend-only'
  );

  insert into private.square_credentials (
    restaurant_id, pos_integration_id, merchant_id, refresh_token_secret_id,
    granted_scopes, connected_by_user_id, credential_generation, last_refreshed_at
  ) values (
    flow.restaurant_id, integration_id, p_merchant_id, new_secret_id,
    p_granted_scopes, flow.actor_user_id,
    coalesce(old_credential.credential_generation, 0) + 1, now()
  )
  on conflict (restaurant_id) do update set
    pos_integration_id = excluded.pos_integration_id,
    merchant_id = excluded.merchant_id,
    refresh_token_secret_id = excluded.refresh_token_secret_id,
    granted_scopes = excluded.granted_scopes,
    connected_by_user_id = excluded.connected_by_user_id,
    credential_generation = excluded.credential_generation,
    last_refreshed_at = now(),
    updated_at = now();

  if old_credential.refresh_token_secret_id is not null
    and old_credential.refresh_token_secret_id <> new_secret_id
  then
    delete from vault.secrets where id = old_credential.refresh_token_secret_id;
  end if;

  update private.square_oauth_flows set completed_at = now() where id = flow.id;
  delete from vault.secrets where id = flow.pkce_verifier_secret_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    flow.restaurant_id, flow.actor_user_id, 'square_connected',
    'pos_integrations', integration_id,
    jsonb_build_object('provider', 'square', 'merchant_id', p_merchant_id)
  );

  return jsonb_build_object(
    'restaurantId', flow.restaurant_id,
    'actorUserId', flow.actor_user_id,
    'integrationId', integration_id,
    'status', 'connected'
  );
end;
$$;

create or replace function public.set_pos_location_status(
  p_restaurant_id uuid,
  p_location_id uuid,
  p_status text
)
returns public.pos_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  location_row public.pos_locations%rowtype;
  previous_status text;
  integration_status text;
begin
  if actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or p_location_id is null then
    raise exception 'Restaurant and location are required' using errcode = '22023';
  end if;
  if p_status is distinct from 'active' and p_status is distinct from 'paused' then
    raise exception 'POS location status must be active or paused' using errcode = '22023';
  end if;
  if not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin']
  ) then
    raise exception 'Owner or admin access required' using errcode = '42501';
  end if;

  select * into location_row
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.id = p_location_id
  for update;

  if not found then
    raise exception 'POS location not found for restaurant' using errcode = 'P0002';
  end if;

  select integration.status into integration_status
  from public.pos_integrations integration
  where integration.restaurant_id = p_restaurant_id
    and integration.id = location_row.pos_integration_id;

  if integration_status is distinct from 'connected' then
    raise exception 'POS integration must be connected to change location status'
      using errcode = '55000';
  end if;

  previous_status := location_row.status;
  if previous_status = p_status then
    return location_row;
  end if;

  update public.pos_locations location
  set
    status = p_status,
    updated_at = pg_catalog.now()
  where location.restaurant_id = p_restaurant_id
    and location.id = p_location_id
  returning location.* into location_row;

  insert into public.audit_logs (
    restaurant_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'pos_location.status_changed',
    'pos_locations',
    location_row.id,
    jsonb_build_object(
      'previous_status', previous_status,
      'status', location_row.status,
      'external_location_id', location_row.external_location_id,
      'pos_integration_id', location_row.pos_integration_id
    )
  );

  return location_row;
end;
$$;

revoke all on function public.set_pos_location_status(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_pos_location_status(uuid, uuid, text)
  to authenticated;

comment on function public.set_pos_location_status(uuid, uuid, text) is
  'Owner/admin authorize (active) or pause a connected POS location. Sync uses active locations only.';
