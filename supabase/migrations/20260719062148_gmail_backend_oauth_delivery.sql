-- Production-oriented Gmail OAuth and supplier delivery boundary.
--
-- Public rows expose connection/delivery metadata only. OAuth state, PKCE
-- verifiers, refresh credentials, and send claims remain private and are
-- reachable solely through actor-bound service-role RPCs used by Edge
-- Functions. Access tokens are intentionally ephemeral and never persisted.

create extension if not exists supabase_vault with schema vault;

alter table public.supplier_orders
  add column if not exists email_provider text,
  add column if not exists provider_message_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by_user_id uuid;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_email_delivery_check;
alter table public.supplier_orders
  add constraint supplier_orders_email_delivery_check check (
    (email_provider is null or email_provider = 'gmail')
    and (provider_message_id is null or length(provider_message_id) between 1 and 512)
    and (
      status = 'draft'
      or email_provider is null
      or (provider_message_id is not null and sent_at is not null and sent_by_user_id is not null)
    )
  );

create unique index if not exists supplier_orders_provider_message_unique_idx
on public.supplier_orders(restaurant_id, email_provider, provider_message_id)
where provider_message_id is not null;

comment on column public.supplier_orders.provider_message_id is
  'Gmail provider message id persisted only after users.messages.send accepts the message.';

-- Connection state is client-readable but provider-owned. A client must never
-- be able to forge `connected` or a verified sender address through Data API.
drop policy if exists "Owners and admins can insert restaurant email connections"
on public.restaurant_email_connections;
drop policy if exists "Owners and admins can update restaurant email connections"
on public.restaurant_email_connections;
drop policy if exists "Owners and admins can delete restaurant email connections"
on public.restaurant_email_connections;
revoke insert, update, delete on public.restaurant_email_connections from authenticated;
grant select on public.restaurant_email_connections to authenticated;

create table if not exists private.gmail_oauth_flows (
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
  constraint gmail_oauth_flows_expiry_check check (expires_at > created_at),
  constraint gmail_oauth_flows_terminal_check check (not (completed_at is not null and failed_at is not null)),
  constraint gmail_oauth_flows_callback_reservation_fkey
    foreign key (restaurant_id, callback_reservation_id)
    references private.edge_function_security_events(restaurant_id, id)
    on delete cascade
);

create table if not exists private.gmail_credentials (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  provider_subject text not null check (length(provider_subject) between 1 and 255),
  sender_email text not null check (
    length(sender_email) between 3 and 254
    and sender_email = lower(sender_email)
    and sender_email !~ '[[:cntrl:]]'
  ),
  refresh_token_secret_id uuid not null unique,
  granted_scopes text[] not null check (
    cardinality(granted_scopes) between 1 and 10
    and 'https://www.googleapis.com/auth/gmail.send' = any(granted_scopes)
  ),
  connected_by_user_id uuid not null,
  credential_generation bigint not null default 1 check (credential_generation > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_refreshed_at timestamptz
);

create table if not exists private.supplier_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  supplier_order_id uuid not null,
  actor_user_id uuid not null,
  idempotency_key uuid not null,
  claim_token uuid not null unique,
  status text not null check (status in ('sending', 'sent', 'failed', 'unknown')),
  attempt_count integer not null default 1 check (attempt_count between 1 and 20),
  rfc_message_id text not null check (
    length(rfc_message_id) between 6 and 512
    and rfc_message_id !~ '[[:cntrl:]]'
  ),
  provider_message_id text check (provider_message_id is null or length(provider_message_id) between 1 and 512),
  last_error_code text check (last_error_code is null or length(last_error_code) between 1 and 80),
  claimed_at timestamptz not null default now(),
  provider_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, supplier_order_id),
  unique (restaurant_id, idempotency_key),
  constraint supplier_email_deliveries_order_fkey
    foreign key (restaurant_id, supplier_order_id)
    references public.supplier_orders(restaurant_id, id)
    on delete cascade,
  constraint supplier_email_deliveries_sent_check check (
    (status = 'sent' and provider_message_id is not null and provider_accepted_at is not null)
    or (status <> 'sent' and provider_message_id is null and provider_accepted_at is null)
  )
);

create unique index if not exists supplier_email_deliveries_provider_message_unique_idx
on private.supplier_email_deliveries(provider_message_id)
where provider_message_id is not null;

create index if not exists gmail_oauth_flows_expiry_idx
on private.gmail_oauth_flows(expires_at)
where completed_at is null and failed_at is null;

create index if not exists supplier_email_deliveries_restaurant_status_idx
on private.supplier_email_deliveries(restaurant_id, status, updated_at desc);

alter table private.gmail_oauth_flows enable row level security;
alter table private.gmail_credentials enable row level security;
alter table private.supplier_email_deliveries enable row level security;

revoke all on table private.gmail_oauth_flows from public, anon, authenticated, service_role;
revoke all on table private.gmail_credentials from public, anon, authenticated, service_role;
revoke all on table private.supplier_email_deliveries from public, anon, authenticated, service_role;
revoke all on table vault.secrets from public, anon, authenticated, service_role;
revoke all on table vault.decrypted_secrets from public, anon, authenticated, service_role;

comment on table private.gmail_credentials is
  'Backend-only Gmail credential metadata. Refresh token values are encrypted by Supabase Vault.';
comment on table private.gmail_oauth_flows is
  'Single-use, ten-minute OAuth state records. PKCE verifier values are encrypted by Supabase Vault.';
comment on table private.supplier_email_deliveries is
  'One idempotent Gmail delivery claim per supplier order. Unknown outcomes require operator review and cannot auto-retry.';

-- The callback has no Supabase JWT because Google invokes it. Its authority is
-- a random, hashed, expiring, single-use state created by an authenticated
-- owner/admin request and tied to a separately reserved firewall invocation.
alter table private.edge_function_security_events
  drop constraint if exists edge_function_security_events_function_name_check;
alter table private.edge_function_security_events
  add constraint edge_function_security_events_function_name_check check (
    function_name in (
      'sync-pos-sales', 'generate-ai-insights', 'link-gmail',
      'gmail-oauth-callback', 'send-supplier-email', 'operational-workflows'
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
      ('operational-workflows', 60, 60, array['owner', 'admin', 'manager']::text[])
  ) policy(function_name, max_attempts, window_seconds, allowed_roles)
  where policy.function_name = p_function_name;
$$;

revoke all on function private.edge_function_policy(text) from public, anon, authenticated, service_role;

create or replace function private.gmail_service_actor_has_role(
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
  select p_actor_user_id is not null
    and p_restaurant_id is not null
    and exists (
      select 1
      from public.restaurant_memberships membership
      where membership.user_id = p_actor_user_id
        and membership.restaurant_id = p_restaurant_id
        and membership.status = 'active'
        and membership.role = any(p_allowed_roles)
    );
$$;

revoke all on function private.gmail_service_actor_has_role(uuid, uuid, text[])
from public, anon, authenticated, service_role;

create or replace function private.gmail_safe_error_code(p_error_code text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Invalid provider error code' using errcode = '22023';
  end if;
  return p_error_code;
end;
$$;

revoke all on function private.gmail_safe_error_code(text)
from public, anon, authenticated, service_role;

create or replace function private.service_begin_gmail_oauth(
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
    raise exception 'Gmail connection access denied' using errcode = '42501';
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
      and reservation.function_name = 'gmail-oauth-callback'
      and reservation.event_type = 'allowed'
      and reservation.created_at >= now() - interval '1 minute'
  ) then
    raise exception 'OAuth callback reservation is unavailable' using errcode = '22023';
  end if;

  -- Expire superseded unclaimed flows without affecting an existing connected
  -- credential during reconnect.
  update private.gmail_oauth_flows
  set failed_at = now(), failure_code = 'superseded'
  where restaurant_id = p_restaurant_id
    and completed_at is null and failed_at is null;

  delete from vault.secrets secret
  using private.gmail_oauth_flows flow
  where secret.id = flow.pkce_verifier_secret_id
    and flow.restaurant_id = p_restaurant_id
    and flow.failure_code = 'superseded';

  verifier_secret_id := vault.create_secret(
    p_code_verifier,
    'mise-gmail-pkce-' || flow_id::text,
    'Mise Gmail PKCE verifier; single-use and expires in ten minutes'
  );

  insert into private.gmail_oauth_flows (
    id, restaurant_id, actor_user_id, callback_reservation_id,
    state_hash, pkce_verifier_secret_id, expires_at
  ) values (
    flow_id, p_restaurant_id, p_actor_user_id, p_callback_reservation_id,
    p_state_hash, verifier_secret_id, now() + interval '10 minutes'
  );

  return jsonb_build_object('flowId', flow_id, 'expiresAt', now() + interval '10 minutes');
end;
$$;

create or replace function public.service_begin_gmail_oauth(
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
  select private.service_begin_gmail_oauth(
    p_actor_user_id, p_restaurant_id, p_callback_reservation_id,
    p_state_hash, p_code_verifier
  );
$$;

create or replace function private.service_claim_gmail_oauth(p_state_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.gmail_oauth_flows%rowtype;
  code_verifier text;
begin
  if p_state_hash is null or p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'OAuth state is invalid' using errcode = '22023';
  end if;

  select * into flow
  from private.gmail_oauth_flows
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
    raise exception 'Gmail connection access denied' using errcode = '42501';
  end if;

  select secret.decrypted_secret into code_verifier
  from vault.decrypted_secrets secret
  where secret.id = flow.pkce_verifier_secret_id;
  if code_verifier is null then
    raise exception 'OAuth verifier is unavailable' using errcode = '55000';
  end if;

  update private.gmail_oauth_flows set claimed_at = now() where id = flow.id;
  return jsonb_build_object(
    'flowId', flow.id,
    'restaurantId', flow.restaurant_id,
    'actorUserId', flow.actor_user_id,
    'callbackReservationId', flow.callback_reservation_id,
    'codeVerifier', code_verifier
  );
end;
$$;

create or replace function public.service_claim_gmail_oauth(p_state_hash text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_claim_gmail_oauth(p_state_hash); $$;

create or replace function private.service_complete_gmail_oauth(
  p_flow_id uuid,
  p_provider_subject text,
  p_sender_email text,
  p_credential_material text,
  p_granted_scopes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.gmail_oauth_flows%rowtype;
  old_credential private.gmail_credentials%rowtype;
  new_secret_id uuid;
  normalized_email text := lower(trim(p_sender_email));
  connection_id uuid;
begin
  select * into flow from private.gmail_oauth_flows where id = p_flow_id for update;
  if not found or flow.claimed_at is null or flow.completed_at is not null or flow.failed_at is not null
    or flow.expires_at <= now()
  then
    raise exception 'OAuth flow cannot be completed' using errcode = '22023';
  end if;
  if not private.gmail_service_actor_has_role(
    flow.actor_user_id, flow.restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Gmail connection access denied' using errcode = '42501';
  end if;
  if p_provider_subject is null or length(p_provider_subject) not between 1 and 255
    or normalized_email is null or length(normalized_email) not between 3 and 254
    or normalized_email ~ '[[:cntrl:]]' or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_credential_material is null or length(p_credential_material) not between 8 and 4096
    or p_granted_scopes is null
    or cardinality(p_granted_scopes) not between 1 and 10
    or 'https://www.googleapis.com/auth/gmail.send' <> all(p_granted_scopes)
  then
    raise exception 'OAuth credential response is invalid' using errcode = '22023';
  end if;

  select * into old_credential
  from private.gmail_credentials
  where restaurant_id = flow.restaurant_id
  for update;

  new_secret_id := vault.create_secret(
    p_credential_material,
    'mise-gmail-refresh-' || flow.restaurant_id::text || '-' || gen_random_uuid()::text,
    'Mise Gmail refresh credential; backend-only'
  );

  insert into private.gmail_credentials (
    restaurant_id, provider_subject, sender_email, refresh_token_secret_id,
    granted_scopes, connected_by_user_id, credential_generation, last_refreshed_at
  ) values (
    flow.restaurant_id, p_provider_subject, normalized_email, new_secret_id,
    p_granted_scopes, flow.actor_user_id,
    coalesce(old_credential.credential_generation, 0) + 1, now()
  )
  on conflict (restaurant_id) do update set
    provider_subject = excluded.provider_subject,
    sender_email = excluded.sender_email,
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

  insert into public.restaurant_email_connections (
    restaurant_id, provider, status, sender_email, last_verified_at
  ) values (
    flow.restaurant_id, 'gmail', 'connected', normalized_email, now()
  )
  on conflict (restaurant_id, provider) do update set
    status = 'connected', sender_email = excluded.sender_email,
    last_verified_at = now(), updated_at = now()
  returning id into connection_id;

  update private.gmail_oauth_flows set completed_at = now() where id = flow.id;
  delete from vault.secrets where id = flow.pkce_verifier_secret_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    flow.restaurant_id, flow.actor_user_id, 'gmail_connected',
    'restaurant_email_connections', connection_id,
    jsonb_build_object('provider', 'gmail', 'sender_email', normalized_email)
  );

  return jsonb_build_object(
    'restaurantId', flow.restaurant_id,
    'actorUserId', flow.actor_user_id,
    'connectionId', connection_id,
    'senderEmail', normalized_email,
    'status', 'connected'
  );
end;
$$;

create or replace function public.service_complete_gmail_oauth(
  p_flow_id uuid,
  p_provider_subject text,
  p_sender_email text,
  p_credential_material text,
  p_granted_scopes text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_complete_gmail_oauth(
    p_flow_id, p_provider_subject, p_sender_email, p_credential_material, p_granted_scopes
  );
$$;

create or replace function private.service_fail_gmail_oauth(
  p_flow_id uuid,
  p_error_code text,
  p_connection_status text default 'not_connected'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  flow private.gmail_oauth_flows%rowtype;
  safe_code text := private.gmail_safe_error_code(p_error_code);
  did_transition boolean := false;
begin
  if p_connection_status not in ('not_connected', 'needs_reauth', 'restricted') then
    raise exception 'Invalid Gmail connection state' using errcode = '22023';
  end if;
  select * into flow from private.gmail_oauth_flows where id = p_flow_id for update;
  if not found then raise exception 'OAuth flow not found' using errcode = '22023'; end if;
  if flow.completed_at is null and flow.failed_at is null then
    update private.gmail_oauth_flows
    set failed_at = now(), failure_code = safe_code
    where id = flow.id;
    delete from vault.secrets where id = flow.pkce_verifier_secret_id;
    did_transition := true;
  end if;

  -- Failed reconnects never destroy an existing valid credential.
  if not exists (
    select 1 from private.gmail_credentials credential
    where credential.restaurant_id = flow.restaurant_id
  ) then
    insert into public.restaurant_email_connections (
      restaurant_id, provider, status, sender_email, last_verified_at
    ) values (
      flow.restaurant_id, 'gmail', p_connection_status, null, null
    )
    on conflict (restaurant_id, provider) do update set
      status = excluded.status, sender_email = null,
      last_verified_at = null, updated_at = now();
  end if;

  if did_transition then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      flow.restaurant_id, flow.actor_user_id, 'gmail_connection_failed',
      'restaurant_email_connections', null,
      jsonb_build_object('provider', 'gmail', 'reason', safe_code)
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

create or replace function public.service_fail_gmail_oauth(
  p_flow_id uuid,
  p_error_code text,
  p_connection_status text default 'not_connected'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_fail_gmail_oauth(p_flow_id, p_error_code, p_connection_status); $$;

create or replace function private.service_fetch_gmail_disconnect_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.gmail_credentials%rowtype;
  decrypted_credential text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Gmail disconnection access denied' using errcode = '42501';
  end if;
  select * into credential
  from private.gmail_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'already_disconnected');
  end if;
  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    raise exception 'Gmail credential is unavailable' using errcode = '55000';
  end if;
  return jsonb_build_object(
    'outcome', 'ready',
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'refreshToken', decrypted_credential
  );
end;
$$;

create or replace function public.service_fetch_gmail_disconnect_credential(
  p_actor_user_id uuid,
  p_restaurant_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.service_fetch_gmail_disconnect_credential(p_actor_user_id, p_restaurant_id); $$;

create or replace function private.service_disconnect_gmail(
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
  credential private.gmail_credentials%rowtype;
  connection_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin']
  ) then
    raise exception 'Gmail disconnection access denied' using errcode = '42501';
  end if;
  select * into credential
  from private.gmail_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found then
    insert into public.restaurant_email_connections (
      restaurant_id, provider, status, sender_email, last_verified_at
    ) values (p_restaurant_id, 'gmail', 'not_connected', null, null)
    on conflict (restaurant_id, provider) do update set
      status = 'not_connected', sender_email = null,
      last_verified_at = null, updated_at = now()
    returning id into connection_id;
    return jsonb_build_object('outcome', 'already_disconnected', 'connectionId', connection_id);
  end if;
  if p_credential_id is null or p_credential_generation is null
    or credential.id <> p_credential_id
    or credential.credential_generation <> p_credential_generation
  then
    raise exception 'Gmail credential changed; retry disconnection' using errcode = '40001';
  end if;

  delete from private.gmail_credentials where id = credential.id;
  delete from vault.secrets where id = credential.refresh_token_secret_id;
  insert into public.restaurant_email_connections (
    restaurant_id, provider, status, sender_email, last_verified_at
  ) values (p_restaurant_id, 'gmail', 'not_connected', null, null)
  on conflict (restaurant_id, provider) do update set
    status = 'not_connected', sender_email = null,
    last_verified_at = null, updated_at = now()
  returning id into connection_id;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'gmail_disconnected',
    'restaurant_email_connections', connection_id,
    jsonb_build_object('provider', 'gmail')
  );
  return jsonb_build_object('outcome', 'disconnected', 'connectionId', connection_id);
end;
$$;

create or replace function public.service_disconnect_gmail(
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
  select private.service_disconnect_gmail(
    p_actor_user_id, p_restaurant_id, p_credential_id, p_credential_generation
  );
$$;

create or replace function private.service_mark_gmail_connection_state(
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
    raise exception 'Gmail state access denied' using errcode = '42501';
  end if;
  if p_status not in ('needs_reauth', 'restricted') then
    raise exception 'Unsupported Gmail connection state' using errcode = '22023';
  end if;
  update public.restaurant_email_connections
  set status = p_status, last_verified_at = null, updated_at = now()
  where restaurant_id = p_restaurant_id and provider = 'gmail';
  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'gmail_connection_state_changed',
    'restaurant_email_connections', null,
    jsonb_build_object('provider', 'gmail', 'status', p_status, 'reason', safe_code)
  );
  return jsonb_build_object('status', p_status);
end;
$$;

create or replace function public.service_mark_gmail_connection_state(
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
  select private.service_mark_gmail_connection_state(
    p_actor_user_id, p_restaurant_id, p_status, p_error_code
  );
$$;

create or replace function private.service_rotate_gmail_refresh_token(
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
  credential private.gmail_credentials%rowtype;
  new_secret_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Gmail refresh access denied' using errcode = '42501';
  end if;
  if p_credential_material is null or length(p_credential_material) not between 8 and 4096 then
    raise exception 'Invalid refresh credential' using errcode = '22023';
  end if;
  select * into credential
  from private.gmail_credentials
  where restaurant_id = p_restaurant_id and id = p_credential_id
  for update;
  if not found then raise exception 'Gmail credential changed' using errcode = '40001'; end if;

  new_secret_id := vault.create_secret(
    p_credential_material,
    'mise-gmail-refresh-' || p_restaurant_id::text || '-' || gen_random_uuid()::text,
    'Rotated Mise Gmail refresh credential; backend-only'
  );
  update private.gmail_credentials
  set refresh_token_secret_id = new_secret_id,
    credential_generation = credential_generation + 1,
    last_refreshed_at = now(), updated_at = now()
  where id = credential.id;
  delete from vault.secrets where id = credential.refresh_token_secret_id;
  return jsonb_build_object('credentialId', credential.id, 'rotated', true);
end;
$$;

create or replace function public.service_rotate_gmail_refresh_token(
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
  select private.service_rotate_gmail_refresh_token(
    p_actor_user_id, p_restaurant_id, p_credential_id, p_credential_material
  );
$$;

create or replace function private.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  restaurant_name text;
  recipient_email text;
  connection public.restaurant_email_connections%rowtype;
  credential private.gmail_credentials%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  decrypted_credential text;
  next_claim_token uuid := gen_random_uuid();
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> p_order_id
    or p_rfc_message_id is null or length(p_rfc_message_id) not between 6 and 512
    or p_rfc_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid supplier email idempotency material' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id
  for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  select * into delivery
  from private.supplier_email_deliveries
  where restaurant_id = p_restaurant_id and supplier_order_id = p_order_id
  for update;

  if found and delivery.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'orderStatus', order_row.status
    );
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be emailed' using errcode = '22023';
  end if;
  if found and delivery.status = 'unknown' then
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if found and delivery.status = 'sending' then
    if delivery.claimed_at >= now() - interval '10 minutes' then
      return jsonb_build_object('outcome', 'in_progress');
    end if;
    update private.supplier_email_deliveries
    set status = 'unknown', last_error_code = 'stale_send_claim', updated_at = now()
    where id = delivery.id;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if found and delivery.idempotency_key <> p_idempotency_key then
    raise exception 'Supplier email idempotency conflict' using errcode = '22023';
  end if;

  select * into connection
  from public.restaurant_email_connections
  where restaurant_id = p_restaurant_id and provider = 'gmail'
  for update;
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select * into credential
  from private.gmail_credentials
  where restaurant_id = p_restaurant_id
  for update;
  if not found or credential.sender_email <> lower(connection.sender_email) then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  select recipient.email into recipient_email
  from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_name = order_row.supplier_name
    and recipient.email is not null
  order by recipient.created_at, recipient.id
  limit 1;
  if recipient_email is null then
    return jsonb_build_object('outcome', 'supplier_email_missing');
  end if;
  if recipient_email ~ '[[:cntrl:]]' or recipient_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(recipient_email) > 254
  then
    return jsonb_build_object('outcome', 'supplier_email_invalid');
  end if;

  select name into restaurant_name from public.restaurants where id = p_restaurant_id;
  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    update public.restaurant_email_connections
    set status = 'needs_reauth', last_verified_at = null, updated_at = now()
    where id = connection.id;
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  if delivery.id is null then
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id
    ) values (
      p_restaurant_id, p_order_id, p_actor_user_id, p_idempotency_key,
      next_claim_token, 'sending', p_rfc_message_id
    ) returning * into delivery;
  else
    update private.supplier_email_deliveries
    set actor_user_id = p_actor_user_id, claim_token = next_claim_token,
      status = 'sending', attempt_count = attempt_count + 1,
      rfc_message_id = p_rfc_message_id, last_error_code = null,
      claimed_at = now(), updated_at = now()
    where id = delivery.id
    returning * into delivery;
  end if;

  return jsonb_build_object(
    'outcome', 'claimed',
    'claimToken', delivery.claim_token,
    'credentialId', credential.id,
    'refreshToken', decrypted_credential,
    'from', credential.sender_email,
    'to', lower(recipient_email),
    'subject', restaurant_name || ' order for ' || order_row.supplier_name,
    'body', order_row.order_message,
    'rfcMessageId', delivery.rfc_message_id
  );
end;
$$;

create or replace function public.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_claim_supplier_email_send(
    p_actor_user_id, p_restaurant_id, p_order_id,
    p_idempotency_key, p_rfc_message_id
  );
$$;

create or replace function private.service_fail_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_code text := private.gmail_safe_error_code(p_error_code);
  next_status text;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_outcome not in ('rejected', 'unknown') then
    raise exception 'Invalid supplier email failure outcome' using errcode = '22023';
  end if;
  next_status := case when p_outcome = 'rejected' then 'failed' else 'unknown' end;
  update private.supplier_email_deliveries
  set status = next_status, last_error_code = safe_code, updated_at = now()
  where restaurant_id = p_restaurant_id
    and supplier_order_id = p_order_id
    and actor_user_id = p_actor_user_id
    and claim_token = p_claim_token
    and status = 'sending';
  if not found then raise exception 'Supplier email claim is unavailable' using errcode = '22023'; end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id,
    case when next_status = 'unknown' then 'supplier_email_outcome_unknown' else 'supplier_email_rejected' end,
    'supplier_orders', p_order_id,
    jsonb_build_object('provider', 'gmail', 'reason', safe_code)
  );
  return jsonb_build_object('outcome', next_status);
end;
$$;

create or replace function public.service_fail_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_fail_supplier_email_send(
    p_actor_user_id, p_restaurant_id, p_order_id,
    p_claim_token, p_outcome, p_error_code
  );
$$;

create or replace function private.service_complete_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery private.supplier_email_deliveries%rowtype;
  order_row public.supplier_orders%rowtype;
  ordered_rows jsonb;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 512
    or p_provider_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid provider message id' using errcode = '22023';
  end if;

  select * into delivery
  from private.supplier_email_deliveries
  where restaurant_id = p_restaurant_id
    and supplier_order_id = p_order_id
  for update;
  if not found then raise exception 'Supplier email claim is unavailable' using errcode = '22023'; end if;
  if delivery.status = 'sent' and delivery.provider_message_id = p_provider_message_id then
    select * into order_row from public.supplier_orders
    where restaurant_id = p_restaurant_id and id = p_order_id;
    return jsonb_build_object('outcome', 'already_applied', 'order', to_jsonb(order_row));
  end if;
  if delivery.status <> 'sending' or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id
  for update;
  if not found or order_row.status <> 'draft' then
    raise exception 'Supplier order is not sendable' using errcode = '22023';
  end if;

  update private.supplier_email_deliveries
  set status = 'sent', provider_message_id = p_provider_message_id,
    provider_accepted_at = now(), last_error_code = null, updated_at = now()
  where id = delivery.id;

  update public.supplier_orders
  set status = 'sent', email_provider = 'gmail',
    provider_message_id = p_provider_message_id,
    sent_at = now(), sent_by_user_id = p_actor_user_id
  where restaurant_id = p_restaurant_id and id = p_order_id
  returning * into order_row;

  update public.purchase_recommendations
  set status = 'ordered'
  where restaurant_id = p_restaurant_id
    and supplier_order_id = p_order_id
    and status = 'approved';

  update public.restaurant_email_connections
  set status = 'connected', last_verified_at = now(), updated_at = now()
  where restaurant_id = p_restaurant_id and provider = 'gmail';

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_order_sent',
    'supplier_orders', p_order_id,
    jsonb_build_object(
      'provider', 'gmail',
      'provider_message_id', p_provider_message_id,
      'ordered_recommendation_count', (
        select count(*) from public.purchase_recommendations recommendation
        where recommendation.restaurant_id = p_restaurant_id
          and recommendation.supplier_order_id = p_order_id
          and recommendation.status = 'ordered'
      )
    )
  );

  select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at), '[]'::jsonb)
  into ordered_rows
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'ordered';
  return jsonb_build_object(
    'outcome', 'applied', 'order', to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

create or replace function public.service_complete_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_complete_supplier_email_send(
    p_actor_user_id, p_restaurant_id, p_order_id,
    p_claim_token, p_provider_message_id
  );
$$;

-- Legacy authenticated calls may observe an already provider-accepted order,
-- but can no longer create a misleading sent state by themselves.
create or replace function public.mark_supplier_order_sent(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  ordered_rows jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into order_row
  from public.supplier_orders
  where restaurant_id = p_restaurant_id and id = p_order_id;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from private.supplier_email_deliveries delivery
    where delivery.restaurant_id = p_restaurant_id
      and delivery.supplier_order_id = p_order_id
      and delivery.status = 'sent'
      and delivery.provider_message_id = order_row.provider_message_id
  ) then
    raise exception 'Provider acceptance is required before marking this order sent' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.created_at), '[]'::jsonb)
  into ordered_rows
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'ordered';
  return jsonb_build_object(
    'outcome', 'already_applied', 'order', to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

-- Explicit grants: only service-role Edge code can cross the Vault/private
-- boundary. The legacy observation RPC remains authenticated and actor-bound.
grant usage on schema private to service_role;
revoke all on function private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_begin_gmail_oauth(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_claim_gmail_oauth(text) from public, anon, authenticated, service_role;
revoke all on function public.service_claim_gmail_oauth(text) from public, anon, authenticated, service_role;
revoke all on function private.service_complete_gmail_oauth(uuid, text, text, text, text[]) from public, anon, authenticated, service_role;
revoke all on function public.service_complete_gmail_oauth(uuid, text, text, text, text[]) from public, anon, authenticated, service_role;
revoke all on function private.service_fail_gmail_oauth(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_fail_gmail_oauth(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_fetch_gmail_disconnect_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.service_fetch_gmail_disconnect_credential(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.service_disconnect_gmail(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function public.service_disconnect_gmail(uuid, uuid, uuid, bigint) from public, anon, authenticated, service_role;
revoke all on function private.service_mark_gmail_connection_state(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_mark_gmail_connection_state(uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role;

grant execute on function private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.service_begin_gmail_oauth(uuid, uuid, uuid, text, text) to service_role;
grant execute on function private.service_claim_gmail_oauth(text) to service_role;
grant execute on function public.service_claim_gmail_oauth(text) to service_role;
grant execute on function private.service_complete_gmail_oauth(uuid, text, text, text, text[]) to service_role;
grant execute on function public.service_complete_gmail_oauth(uuid, text, text, text, text[]) to service_role;
grant execute on function private.service_fail_gmail_oauth(uuid, text, text) to service_role;
grant execute on function public.service_fail_gmail_oauth(uuid, text, text) to service_role;
grant execute on function private.service_fetch_gmail_disconnect_credential(uuid, uuid) to service_role;
grant execute on function public.service_fetch_gmail_disconnect_credential(uuid, uuid) to service_role;
grant execute on function private.service_disconnect_gmail(uuid, uuid, uuid, bigint) to service_role;
grant execute on function public.service_disconnect_gmail(uuid, uuid, uuid, bigint) to service_role;
grant execute on function private.service_mark_gmail_connection_state(uuid, uuid, text, text) to service_role;
grant execute on function public.service_mark_gmail_connection_state(uuid, uuid, text, text) to service_role;
grant execute on function private.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text) to service_role;
grant execute on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function private.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text) to service_role;
grant execute on function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) to service_role;
grant execute on function public.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text) to service_role;

revoke all on function public.mark_supplier_order_sent(uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.mark_supplier_order_sent(uuid, uuid) to authenticated;
