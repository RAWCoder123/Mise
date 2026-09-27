-- MISE-005AZ: pin private.square_credentials.merchant_id shape CHECK and
-- writer gates to COLLATE "C".
--
-- private.square_credentials still stores merchant_id under a length-only
-- bound from the Square OAuth sync migration:
--   length(merchant_id) between 1 and 128
-- Hosted writers accept the same length-only gate:
--   private.service_complete_square_oauth
--   private.service_resolve_square_webhook_merchant
-- Edge token parsing used unbounded stringField (any non-control Unicode).
--
-- merchant_id is the durable global Square merchant identity
-- (UNIQUE on private.square_credentials(merchant_id)) used to resolve webhook
-- targets and bind refresh credentials. Square issues opaque ASCII merchant
-- tokens (alphanumeric, with optional `_` / `-`). Authenticated clients hold
-- no direct access; inserts/lookups are SECURITY DEFINER service_role only.
--
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; later 005*
-- tips pinned OAuth state_hash/PKCE (#438) and provider failure codes
-- (#439/#450), but left Square merchant_id on length-only bounds because the
-- Edge stringField writer had no ASCII allowlist yet.
--
-- If LC_CTYPE drifted under a length-only CHECK, dump/restore could accept a
-- merchant identity the restored C-locale ASCII gate would refuse (or the
-- reverse), breaking webhook merchant resolution and credential reconnect
-- continuity across restore.
--
-- Scope:
--   - Replace length-only merchant_id CHECK with named shape CHECK:
--     merchant_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
--   - Rewrite private complete-oauth + webhook-resolve gates to the same
--     COLLATE "C" class (clear 22023 before CHECK)
--   - Preserve service_role EXECUTE; keep public wrappers untouched
-- Does NOT rewrite begin/claim OAuth (#438), gmail_safe_error_code (#439),
-- activity_events / restaurant_memories / inventory_events (#375), or
-- supplier confirmation / delivery identity (#458/#459).
-- Timestamp after MISE-005AY (#459).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.square_credentials'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'square_credentials_merchant_id_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%merchant_id%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length(merchant_id)%'
            or pg_get_constraintdef(con.oid) ilike '%^[A-Za-z0-9_-]{1,128}$%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table private.square_credentials drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.square_credentials
  drop constraint if exists square_credentials_merchant_id_check;

alter table private.square_credentials
  add constraint square_credentials_merchant_id_check check (
    merchant_id collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'
  );

comment on constraint square_credentials_merchant_id_check
  on private.square_credentials is
  'MISE-005AZ: ASCII Square merchant_id under COLLATE "C".';

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
  if p_merchant_id is null
    or p_merchant_id collate "C" !~ '^[A-Za-z0-9_-]{1,128}$'
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
  if p_merchant_id is null
    or p_merchant_id collate "C" !~ '^[A-Za-z0-9_-]{1,128}$'
  then
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

revoke all on function private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.service_resolve_square_webhook_merchant(text)
  from public, anon, authenticated, service_role;

grant execute on function private.service_complete_square_oauth(uuid, text, text, text, text[], jsonb)
  to service_role;
grant execute on function private.service_resolve_square_webhook_merchant(text)
  to service_role;
