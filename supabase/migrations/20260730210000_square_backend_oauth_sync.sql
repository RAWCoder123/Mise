-- Square OAuth + sales/catalog sync boundary.
-- Public pos_integrations stays secret-free. Refresh tokens live in Vault.

create extension if not exists supabase_vault with schema vault;

-- Connection state is provider-owned. Clients may read but never forge connected.
drop policy if exists "Owners and admins can insert pos integrations"
on public.pos_integrations;
drop policy if exists "Owners and admins can update pos integrations"
on public.pos_integrations;
drop policy if exists "Owners and admins can delete pos integrations"
on public.pos_integrations;
revoke insert, update, delete on public.pos_integrations from authenticated;
grant select on public.pos_integrations to authenticated;

create table if not exists private.square_oauth_flows (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  actor_user_id uuid not null,
  callback_reservation_id uuid not null,
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  pkce_verifier_secret_id uuid not null,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text check (failure_code is null or length(failure_code) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint square_oauth_flows_expiry_check check (expires_at > created_at),
  constraint square_oauth_flows_terminal_check check (not (completed_at is not null and failed_at is not null)),
  constraint square_oauth_flows_callback_reservation_fkey
    foreign key (restaurant_id, callback_reservation_id)
    references private.edge_function_security_events(restaurant_id, id)
    on delete cascade
);

create table if not exists private.square_credentials (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  pos_integration_id uuid not null,
  merchant_id text not null check (length(merchant_id) between 1 and 128),
  refresh_token_secret_id uuid not null unique,
  granted_scopes text[] not null check (
    cardinality(granted_scopes) between 1 and 20
    and 'ORDERS_READ' = any(granted_scopes)
    and 'ITEMS_READ' = any(granted_scopes)
    and 'MERCHANT_PROFILE_READ' = any(granted_scopes)
  ),
  connected_by_user_id uuid not null,
  credential_generation bigint not null default 1 check (credential_generation > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  constraint square_credentials_integration_fkey
    foreign key (restaurant_id, pos_integration_id)
    references public.pos_integrations(restaurant_id, id)
    on delete cascade
);

create unique index if not exists square_credentials_merchant_id_key
on private.square_credentials(merchant_id);

create index if not exists square_oauth_flows_expiry_idx
on private.square_oauth_flows(expires_at)
where completed_at is null and failed_at is null;

alter table private.square_oauth_flows enable row level security;
alter table private.square_credentials enable row level security;

revoke all on table private.square_oauth_flows from public, anon, authenticated, service_role;
revoke all on table private.square_credentials from public, anon, authenticated, service_role;

comment on table private.square_credentials is
  'Backend-only Square credential metadata. Refresh token values are encrypted by Supabase Vault.';
comment on table private.square_oauth_flows is
  'Single-use, ten-minute OAuth state records for Square connect.';

alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
      'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows',
      'delete-account', 'export-restaurant-data',
      'link-square', 'square-oauth-callback', 'square-webhooks'
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
      ('gmail-oauth-callback', 4, 300, array['owner', 'admin']::text[]),
      ('send-supplier-email', 12, 60, array['owner', 'admin', 'manager']::text[]),
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager']::text[]),
      ('delete-account', 3, 300, array['owner', 'admin', 'manager', 'staff']::text[]),
      ('export-restaurant-data', 4, 300, array['owner', 'admin']::text[]),
      ('link-square', 4, 300, array['owner', 'admin']::text[]),
      ('square-oauth-callback', 4, 300, array['owner', 'admin']::text[]),
      ('square-webhooks', 30, 60, array['owner', 'admin', 'manager']::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text)
  from public, anon, authenticated, service_role;

create or replace function private.service_begin_square_oauth(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_callback_reservation_id uuid,
  p_state_hash text,
  p_code_verifier text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow_id uuid := gen_random_uuid();
  verifier_secret_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Square connection access denied' using errcode = '42501';
  end if;
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_code_verifier is null or length(p_code_verifier) not between 43 and 128
    or p_code_verifier !~ '^[A-Za-z0-9._~-]+$'
  then
    raise exception 'Invalid OAuth flow material' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from private.edge_function_security_events reservation
    where reservation.id = p_callback_reservation_id
      and reservation.restaurant_id = p_restaurant_id
      and reservation.actor_user_id = p_actor_user_id
      and reservation.function_name = 'square-oauth-callback'
      and reservation.event_type = 'allowed'
      and reservation.created_at >= now() - interval '1 minute'
  ) then
    raise exception 'OAuth callback reservation is unavailable' using errcode = '22023';
  end if;

  update private.square_oauth_flows
  set failed_at = now(), failure_code = 'superseded'
  where restaurant_id = p_restaurant_id
    and completed_at is null and failed_at is null;

  delete from vault.secrets secret
  using private.square_oauth_flows flow
  where secret.id = flow.pkce_verifier_secret_id
    and flow.restaurant_id = p_restaurant_id
    and flow.failure_code = 'superseded';

  verifier_secret_id := vault.create_secret(
    p_code_verifier,
    'mise-square-flow-' || flow_id::text,
    'Mise Square OAuth flow binding; single-use and expires in ten minutes'
  );

  insert into private.square_oauth_flows (
    id, restaurant_id, actor_user_id, callback_reservation_id,
    state_hash, pkce_verifier_secret_id, expires_at
  ) values (
    flow_id, p_restaurant_id, p_actor_user_id, p_callback_reservation_id,
    p_state_hash, verifier_secret_id, now() + interval '10 minutes'
  );

  return jsonb_build_object('flowId', flow_id, 'expiresAt', now() + interval '10 minutes');
end;
$$;

create or replace function public.service_begin_square_oauth(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_callback_reservation_id uuid,
  p_state_hash text,
  p_code_verifier text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_begin_square_oauth(
    p_actor_user_id, p_restaurant_id, p_callback_reservation_id,
    p_state_hash, p_code_verifier
  );
$$;

create or replace function private.service_claim_square_oauth(p_state_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.square_oauth_flows%rowtype;
  code_verifier text;
begin
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'OAuth state is invalid' using errcode = '22023';
  end if;

  select * into flow
  from private.square_oauth_flows
  where state_hash = p_state_hash
  for update;

  if not found or flow.expires_at <= now() or flow.claimed_at is not null
    or flow.completed_at is not null or flow.failed_at is not null
  then
    raise exception 'OAuth state is invalid or expired' using errcode = '22023';
  end if;
  if not private.gmail_service_actor_has_role(
    flow.actor_user_id, flow.restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Square connection access denied' using errcode = '42501';
  end if;

  select secret.decrypted_secret into code_verifier
  from vault.decrypted_secrets secret
  where secret.id = flow.pkce_verifier_secret_id;
  if code_verifier is null then
    raise exception 'OAuth verifier is unavailable' using errcode = '55000';
  end if;

  update private.square_oauth_flows set claimed_at = now() where id = flow.id;
  return jsonb_build_object(
    'flowId', flow.id,
    'restaurantId', flow.restaurant_id,
    'actorUserId', flow.actor_user_id,
    'callbackReservationId', flow.callback_reservation_id,
    'codeVerifier', code_verifier
  );
end;
$$;

create or replace function public.service_claim_square_oauth(p_state_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_claim_square_oauth(p_state_hash); $$;

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
      status = 'active',
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

create or replace function public.service_complete_square_oauth(
  p_flow_id uuid,
  p_merchant_id text,
  p_external_location_id text,
  p_credential_material text,
  p_granted_scopes text[],
  p_locations jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_complete_square_oauth(
    p_flow_id, p_merchant_id, p_external_location_id,
    p_credential_material, p_granted_scopes, p_locations
  );
$$;

create or replace function private.service_fail_square_oauth(
  p_flow_id uuid,
  p_error_code text,
  p_connection_status text default 'error'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.square_oauth_flows%rowtype;
  safe_code text := private.gmail_safe_error_code(p_error_code);
  did_transition boolean := false;
begin
  if p_connection_status not in ('not_connected', 'error', 'paused') then
    raise exception 'Invalid Square connection state' using errcode = '22023';
  end if;
  select * into flow from private.square_oauth_flows where id = p_flow_id for update;
  if not found then raise exception 'OAuth flow not found' using errcode = '22023'; end if;
  if flow.completed_at is null and flow.failed_at is null then
    update private.square_oauth_flows
    set failed_at = now(), failure_code = safe_code
    where id = flow.id;
    delete from vault.secrets where id = flow.pkce_verifier_secret_id;
    did_transition := true;
  end if;

  if not exists (
    select 1 from private.square_credentials credential
    where credential.restaurant_id = flow.restaurant_id
  ) then
    insert into public.pos_integrations (
      restaurant_id, provider, status, settings
    ) values (
      flow.restaurant_id, 'square', p_connection_status, '{}'::jsonb
    )
    on conflict (restaurant_id, provider) do update set
      status = excluded.status, updated_at = now();
  end if;

  if did_transition then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      flow.restaurant_id, flow.actor_user_id, 'square_connection_failed',
      'pos_integrations', null,
      jsonb_build_object('provider', 'square', 'reason', safe_code)
    );
  end if;
  return jsonb_build_object(
    'restaurantId', flow.restaurant_id,
    'actorUserId', flow.actor_user_id,
    'callbackReservationId', flow.callback_reservation_id,
    'status', p_connection_status
  );
end;
$$;

create or replace function public.service_fail_square_oauth(
  p_flow_id uuid,
  p_error_code text,
  p_connection_status text default 'error'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_fail_square_oauth(p_flow_id, p_error_code, p_connection_status); $$;

create or replace function private.service_fetch_square_disconnect_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.square_credentials%rowtype;
  decrypted_credential text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Square disconnection access denied' using errcode = '42501';
  end if;
  select * into credential
  from private.square_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'already_disconnected');
  end if;
  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    raise exception 'Square credential is unavailable' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'outcome', 'ready',
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'refreshToken', decrypted_credential
  );
end;
$$;

create or replace function public.service_fetch_square_disconnect_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_fetch_square_disconnect_credential(p_actor_user_id, p_restaurant_id); $$;

create or replace function private.service_disconnect_square(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_credential_generation bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.square_credentials%rowtype;
  integration_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Square disconnection access denied' using errcode = '42501';
  end if;
  select * into credential
  from private.square_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then
    update public.pos_integrations
    set status = 'not_connected', updated_at = now()
    where restaurant_id = p_restaurant_id and provider = 'square'
    returning id into integration_id;
    return jsonb_build_object('outcome', 'already_disconnected', 'integrationId', integration_id);
  end if;
  if p_credential_id is null or p_credential_generation is null
    or credential.id <> p_credential_id
    or credential.credential_generation <> p_credential_generation
  then
    raise exception 'Square credential changed; retry disconnection' using errcode = '40001';
  end if;

  delete from private.square_credentials where id = credential.id;
  delete from vault.secrets where id = credential.refresh_token_secret_id;
  update public.pos_integrations
  set status = 'not_connected', last_sync_at = null, sync_cursor = null, updated_at = now()
  where restaurant_id = p_restaurant_id and provider = 'square'
  returning id into integration_id;

  update public.pos_locations
  set status = 'disconnected', updated_at = now()
  where restaurant_id = p_restaurant_id
    and pos_integration_id = credential.pos_integration_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_disconnected',
    'pos_integrations', integration_id,
    jsonb_build_object('provider', 'square')
  );
  return jsonb_build_object('outcome', 'disconnected', 'integrationId', integration_id);
end;
$$;

create or replace function public.service_disconnect_square(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_credential_generation bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_disconnect_square(
    p_actor_user_id, p_restaurant_id, p_credential_id, p_credential_generation
  );
$$;

create or replace function private.service_fetch_square_sync_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  credential private.square_credentials%rowtype;
  decrypted_credential text;
  location_ids text[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;

  select * into system_controls from public.system_operational_controls where singleton;
  if not found
    or system_controls.operational_mode <> 'normal'
    or not system_controls.square_sync_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  insert into public.restaurant_operational_controls (restaurant_id)
  values (p_restaurant_id)
  on conflict (restaurant_id) do nothing;

  select * into restaurant_controls
  from public.restaurant_operational_controls
  where restaurant_id = p_restaurant_id;
  if not found or not restaurant_controls.square_sync_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into credential
  from private.square_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'not_connected');
  end if;

  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    raise exception 'Square credential is unavailable' using errcode = '55000';
  end if;

  select coalesce(array_agg(location.external_location_id order by location.created_at), '{}')
  into location_ids
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = credential.pos_integration_id
    and location.status = 'active';

  return jsonb_build_object(
    'outcome', 'ready',
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'integrationId', credential.pos_integration_id,
    'merchantId', credential.merchant_id,
    'refreshToken', decrypted_credential,
    'locationIds', to_jsonb(location_ids)
  );
end;
$$;

create or replace function public.service_fetch_square_sync_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_fetch_square_sync_credential(p_actor_user_id, p_restaurant_id); $$;

create or replace function private.service_mark_square_connection_state(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_status text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_code text := private.gmail_safe_error_code(p_error_code);
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square state access denied' using errcode = '42501';
  end if;
  if p_status not in ('error', 'paused', 'connected') then
    raise exception 'Unsupported Square connection state' using errcode = '22023';
  end if;
  update public.pos_integrations
  set status = p_status, updated_at = now()
  where restaurant_id = p_restaurant_id and provider = 'square';
  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_connection_state_changed',
    'pos_integrations', null,
    jsonb_build_object('provider', 'square', 'status', p_status, 'reason', safe_code)
  );
  return jsonb_build_object('status', p_status);
end;
$$;

create or replace function public.service_mark_square_connection_state(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_status text,
  p_error_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_mark_square_connection_state(
    p_actor_user_id, p_restaurant_id, p_status, p_error_code
  );
$$;

create or replace function private.service_rotate_square_refresh_token(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_credential_material text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.square_credentials%rowtype;
  new_secret_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square refresh access denied' using errcode = '42501';
  end if;
  if p_credential_material is null or length(p_credential_material) not between 8 and 4096 then
    raise exception 'Invalid refresh credential' using errcode = '22023';
  end if;
  select * into credential
  from private.square_credentials
  where restaurant_id = p_restaurant_id and id = p_credential_id
  for update;
  if not found then raise exception 'Square credential changed' using errcode = '40001'; end if;

  new_secret_id := vault.create_secret(
    p_credential_material,
    'mise-square-refresh-' || p_restaurant_id::text || '-' || gen_random_uuid()::text,
    'Rotated Mise Square refresh credential; backend-only'
  );
  update private.square_credentials
  set refresh_token_secret_id = new_secret_id,
    credential_generation = credential_generation + 1,
    last_refreshed_at = now(), updated_at = now()
  where id = credential.id;
  delete from vault.secrets where id = credential.refresh_token_secret_id;
  return jsonb_build_object('credentialId', credential.id, 'rotated', true);
end;
$$;

create or replace function public.service_rotate_square_refresh_token(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_credential_material text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_rotate_square_refresh_token(
    p_actor_user_id, p_restaurant_id, p_credential_id, p_credential_material
  );
$$;

create or replace function private.service_apply_square_sync_result(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  sale jsonb;
  catalog_item jsonb;
  import_id uuid := gen_random_uuid();
  records_processed integer := 0;
  catalog_processed integer := 0;
  resolved_menu_item_id uuid;
  location_id uuid;
  catalog_external_name text;
  catalog_item_external_id text;
  catalog_variation_id text;
  updated_mapping_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;
  if p_sales is null or jsonb_typeof(p_sales) <> 'array'
    or p_catalog_items is null or jsonb_typeof(p_catalog_items) <> 'array'
    or p_from is null or p_to is null or p_to < p_from
  then
    raise exception 'Square sync payload is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pos_integrations integration
    where integration.id = p_integration_id
      and integration.restaurant_id = p_restaurant_id
      and integration.provider = 'square'
  ) then
    raise exception 'Square integration not found' using errcode = '22023';
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'processing',
    0, jsonb_build_object('provider', 'square', 'from', p_from, 'to', p_to), now()
  );

  for sale in select value from jsonb_array_elements(p_sales)
  loop
    if coalesce(sale->>'source_record_id', '') = ''
      or coalesce(sale->>'item_name', '') = ''
      or coalesce(sale->>'sale_date', '') = ''
    then
      continue;
    end if;
    insert into public.pos_sales (
      restaurant_id, sale_date, item_name, category, quantity_sold,
      gross_sales, net_sales, source_pos, source_record_id
    ) values (
      p_restaurant_id,
      (sale->>'sale_date')::date,
      left(sale->>'item_name', 160),
      left(coalesce(sale->>'category', 'Square'), 80),
      least(100000::numeric, greatest(0.0001::numeric, (sale->>'quantity_sold')::numeric)),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'gross_sales')::numeric, 0))),
      least(10000000::numeric, greatest(0::numeric, coalesce((sale->>'net_sales')::numeric, 0))),
      'Square',
      left(sale->>'source_record_id', 200)
    )
    on conflict (restaurant_id, source_pos, source_record_id)
      where source_record_id is not null
    do update set
      sale_date = excluded.sale_date,
      item_name = excluded.item_name,
      category = excluded.category,
      quantity_sold = excluded.quantity_sold,
      gross_sales = excluded.gross_sales,
      net_sales = excluded.net_sales;
    records_processed := records_processed + 1;
  end loop;

  select location.id into location_id
  from public.pos_locations location
  where location.restaurant_id = p_restaurant_id
    and location.pos_integration_id = p_integration_id
    and location.status = 'active'
  order by location.created_at
  limit 1;

  for catalog_item in select value from jsonb_array_elements(p_catalog_items)
  loop
    resolved_menu_item_id := null;
    updated_mapping_id := null;
    catalog_external_name := left(trim(coalesce(catalog_item->>'external_name', '')), 160);
    catalog_item_external_id := left(coalesce(catalog_item->>'external_catalog_item_id', ''), 128);
    catalog_variation_id := left(coalesce(catalog_item->>'external_variation_id', ''), 128);
    if catalog_external_name = '' or catalog_item_external_id = '' then
      continue;
    end if;

    select item.id into resolved_menu_item_id
    from public.menu_items item
    where item.restaurant_id = p_restaurant_id
      and lower(trim(item.name)) = lower(trim(catalog_external_name))
    limit 1;

    if resolved_menu_item_id is null then
      insert into public.menu_items (restaurant_id, name, category, active)
      values (
        p_restaurant_id,
        catalog_external_name,
        left(coalesce(catalog_item->>'category', 'Square'), 80),
        true
      )
      returning id into resolved_menu_item_id;
    else
      update public.menu_items
      set category = left(coalesce(catalog_item->>'category', 'Square'), 80),
        active = true,
        updated_at = now()
      where id = resolved_menu_item_id and restaurant_id = p_restaurant_id;
    end if;

    if location_id is not null and resolved_menu_item_id is not null then
      update public.pos_catalog_item_mappings mapping
      set external_name = catalog_external_name,
        menu_item_id = resolved_menu_item_id,
        updated_at = now()
      where mapping.restaurant_id = p_restaurant_id
        and mapping.pos_location_id = location_id
        and mapping.external_catalog_item_id = catalog_item_external_id
        and mapping.external_variation_id = catalog_variation_id
        and mapping.effective_to is null
      returning mapping.id into updated_mapping_id;

      if updated_mapping_id is null then
        insert into public.pos_catalog_item_mappings (
          restaurant_id, pos_location_id, external_catalog_item_id, external_variation_id,
          external_name, menu_item_id, verification_status, confidence
        ) values (
          p_restaurant_id,
          location_id,
          catalog_item_external_id,
          catalog_variation_id,
          catalog_external_name,
          resolved_menu_item_id,
          'draft',
          0
        );
      end if;
      catalog_processed := catalog_processed + 1;
      updated_mapping_id := null;
    end if;
  end loop;

  update public.sales_imports
  set status = 'completed',
    records_processed = records_processed,
    metadata = jsonb_build_object(
      'provider', 'square',
      'from', p_from,
      'to', p_to,
      'catalog_processed', catalog_processed
    ),
    imported_at = now()
  where id = import_id;

  update public.pos_integrations
  set status = 'connected',
    last_sync_at = now(),
    sync_cursor = nullif(left(coalesce(p_sync_cursor, ''), 500), ''),
    updated_at = now()
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'square_sync_completed',
    'sales_imports', import_id,
    jsonb_build_object(
      'provider', 'square',
      'records_processed', records_processed,
      'catalog_processed', catalog_processed
    )
  );

  return jsonb_build_object(
    'importId', import_id,
    'recordsProcessed', records_processed,
    'catalogProcessed', catalog_processed,
    'status', 'completed'
  );
end;
$$;

create or replace function public.service_apply_square_sync_result(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_sales jsonb,
  p_catalog_items jsonb,
  p_sync_cursor text,
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_apply_square_sync_result(
    p_actor_user_id, p_restaurant_id, p_integration_id,
    p_sales, p_catalog_items, p_sync_cursor, p_from, p_to
  );
$$;

create or replace function private.service_resolve_square_webhook_merchant(
  p_merchant_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.square_credentials%rowtype;
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
begin
  if p_merchant_id is null or length(p_merchant_id) not between 1 and 128 then
    raise exception 'Invalid merchant id' using errcode = '22023';
  end if;

  select * into credential
  from private.square_credentials
  where merchant_id = p_merchant_id
  limit 1;
  if not found then
    return jsonb_build_object('outcome', 'unknown_merchant');
  end if;

  select * into system_controls from public.system_operational_controls where singleton;
  if not found
    or system_controls.operational_mode <> 'normal'
    or not system_controls.square_webhooks_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into restaurant_controls
  from public.restaurant_operational_controls
  where restaurant_id = credential.restaurant_id;
  if not found or not restaurant_controls.square_webhooks_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'restaurantId', credential.restaurant_id,
    'actorUserId', credential.connected_by_user_id,
    'integrationId', credential.pos_integration_id,
    'merchantId', credential.merchant_id
  );
end;
$$;

create or replace function public.service_resolve_square_webhook_merchant(
  p_merchant_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_resolve_square_webhook_merchant(p_merchant_id); $$;

create or replace function private.service_record_square_sync_failure(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_error_code text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_id uuid := gen_random_uuid();
  safe_code text := private.gmail_safe_error_code(p_error_code);
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Square sync access denied' using errcode = '42501';
  end if;

  insert into public.sales_imports (
    id, restaurant_id, pos_integration_id, import_type, status,
    records_processed, error_message, metadata, imported_at
  ) values (
    import_id, p_restaurant_id, p_integration_id, 'pos_sync', 'failed',
    0, left(safe_code, 200),
    jsonb_build_object('provider', 'square', 'from', p_from, 'to', p_to, 'reason', safe_code),
    now()
  );

  update public.pos_integrations
  set status = 'error', updated_at = now()
  where id = p_integration_id and restaurant_id = p_restaurant_id;

  return jsonb_build_object('importId', import_id, 'status', 'failed', 'reason', safe_code);
end;
$$;

create or replace function public.service_record_square_sync_failure(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_integration_id uuid,
  p_error_code text,
  p_from date,
  p_to date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_record_square_sync_failure(
    p_actor_user_id, p_restaurant_id, p_integration_id, p_error_code, p_from, p_to
  );
$$;

revoke all on function private.service_begin_square_oauth(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_claim_square_oauth(text) from public, anon, authenticated, service_role;
revoke all on function private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb) from public, anon, authenticated, service_role;
revoke all on function private.service_fail_square_oauth(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_fetch_square_disconnect_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.service_disconnect_square(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function private.service_fetch_square_sync_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.service_mark_square_connection_state(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_rotate_square_refresh_token(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.service_apply_square_sync_result(uuid, uuid, uuid, jsonb, jsonb, text, date, date) from public, anon, authenticated, service_role;
revoke all on function private.service_record_square_sync_failure(uuid, uuid, uuid, text, date, date) from public, anon, authenticated, service_role;
revoke all on function private.service_resolve_square_webhook_merchant(text) from public, anon, authenticated, service_role;

revoke all on function public.service_begin_square_oauth(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_claim_square_oauth(text) from public, anon, authenticated, service_role;
revoke all on function public.service_complete_square_oauth(uuid, text, text, text, text[], jsonb) from public, anon, authenticated, service_role;
revoke all on function public.service_fail_square_oauth(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_fetch_square_disconnect_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_disconnect_square(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function public.service_fetch_square_sync_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_mark_square_connection_state(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_rotate_square_refresh_token(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.service_apply_square_sync_result(uuid, uuid, uuid, jsonb, jsonb, text, date, date) from public, anon, authenticated, service_role;
revoke all on function public.service_record_square_sync_failure(uuid, uuid, uuid, text, date, date) from public, anon, authenticated, service_role;
revoke all on function public.service_resolve_square_webhook_merchant(text) from public, anon, authenticated, service_role;

grant execute on function private.service_begin_square_oauth(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.service_begin_square_oauth(uuid, uuid, uuid, text, text) to service_role;
grant execute on function private.service_claim_square_oauth(text) to service_role;
grant execute on function public.service_claim_square_oauth(text) to service_role;
grant execute on function private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb) to service_role;
grant execute on function public.service_complete_square_oauth(uuid, text, text, text, text[], jsonb) to service_role;
grant execute on function private.service_fail_square_oauth(uuid, text, text) to service_role;
grant execute on function public.service_fail_square_oauth(uuid, text, text) to service_role;
grant execute on function private.service_fetch_square_disconnect_credential(uuid, uuid) to service_role;
grant execute on function public.service_fetch_square_disconnect_credential(uuid, uuid) to service_role;
grant execute on function private.service_disconnect_square(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.service_disconnect_square(uuid, uuid, uuid, bigint) to service_role;
grant execute on function private.service_fetch_square_sync_credential(uuid, uuid) to service_role;
grant execute on function public.service_fetch_square_sync_credential(uuid, uuid) to service_role;
grant execute on function private.service_mark_square_connection_state(uuid, uuid, text, text) to service_role;
grant execute on function public.service_mark_square_connection_state(uuid, uuid, text, text) to service_role;
grant execute on function private.service_rotate_square_refresh_token(uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_rotate_square_refresh_token(uuid, uuid, uuid, text) to service_role;
grant execute on function private.service_apply_square_sync_result(uuid, uuid, uuid, jsonb, jsonb, text, date, date) to service_role;
grant execute on function public.service_apply_square_sync_result(uuid, uuid, uuid, jsonb, jsonb, text, date, date) to service_role;
grant execute on function private.service_record_square_sync_failure(uuid, uuid, uuid, text, date, date) to service_role;
grant execute on function public.service_record_square_sync_failure(uuid, uuid, uuid, text, date, date) to service_role;
grant execute on function private.service_resolve_square_webhook_merchant(text) to service_role;
grant execute on function public.service_resolve_square_webhook_merchant(text) to service_role;
