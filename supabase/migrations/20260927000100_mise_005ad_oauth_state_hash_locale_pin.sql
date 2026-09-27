-- MISE-005AD: pin Gmail/Square OAuth state_hash + PKCE verifier classes to
-- COLLATE "C".
--
-- private.gmail_oauth_flows and private.square_oauth_flows still store:
--   state_hash ~ '^[0-9a-f]{64}$'
-- and private.service_begin_*_oauth / service_claim_*_oauth still gate with:
--   p_state_hash !~ '^[0-9a-f]{64}$'
--   p_code_verifier !~ '^[A-Za-z0-9._~-]+$'
-- POSIX [0-9a-f] and [A-Za-z0-9] follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; later
-- 005* tips pinned emails, fingerprints, and profile shape classes, but left
-- the OAuth CSRF state hash and PKCE verifier allowlists on bare classes.
--
-- state_hash is the durable single-use OAuth CSRF binding. The PKCE verifier
-- is the single-use code binding stored in Vault for the claim step. If
-- LC_CTYPE drifted under a bare class check, dump/restore could reject flow
-- rows the source accepted — and begin/claim preflights could accept bytes
-- the CHECK would refuse (or the reverse), breaking reconnect continuity for
-- Gmail and Square.
--
-- Scope:
--   - Reattach gmail/square oauth_flows state_hash CHECKs with COLLATE "C"
--   - Rewrite private begin/claim RPCs so hex + PKCE gates use COLLATE "C"
--   - Preserve service_role EXECUTE; keep public wrappers untouched
-- Does NOT rewrite complete-oauth (owned by open MISE-005O for Gmail),
-- gmail_safe_error_code, or Edge Function bodies. Compose-safe alone on main
-- (begin/claim unreplaced since original Gmail/Square oauth migrations).
-- Timestamp after MISE-005AC.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.gmail_oauth_flows'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%state_hash%'
      and pg_get_constraintdef(con.oid) ilike '%0-9a-f%'
    order by con.conname
  loop
    execute format(
      'alter table private.gmail_oauth_flows drop constraint %I',
      constraint_name
    );
  end loop;

  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'private.square_oauth_flows'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%state_hash%'
      and pg_get_constraintdef(con.oid) ilike '%0-9a-f%'
    order by con.conname
  loop
    execute format(
      'alter table private.square_oauth_flows drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table private.gmail_oauth_flows
  drop constraint if exists gmail_oauth_flows_state_hash_check;

alter table private.gmail_oauth_flows
  add constraint gmail_oauth_flows_state_hash_check
    check (state_hash collate "C" ~ '^[0-9a-f]{64}$');

comment on constraint gmail_oauth_flows_state_hash_check
  on private.gmail_oauth_flows is
  'MISE-005AD: 64-char lowercase hex OAuth state hash under COLLATE "C".';

alter table private.square_oauth_flows
  drop constraint if exists square_oauth_flows_state_hash_check;

alter table private.square_oauth_flows
  add constraint square_oauth_flows_state_hash_check
    check (state_hash collate "C" ~ '^[0-9a-f]{64}$');

comment on constraint square_oauth_flows_state_hash_check
  on private.square_oauth_flows is
  'MISE-005AD: 64-char lowercase hex OAuth state hash under COLLATE "C".';

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
  if p_state_hash is null or p_state_hash collate "C" !~ '^[0-9a-f]{64}$'
    or p_code_verifier is null or length(p_code_verifier) not between 43 and 128
    or p_code_verifier collate "C" !~ '^[A-Za-z0-9._~-]+$'
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

comment on function private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text) is
  'MISE-005AD: begin Gmail OAuth; state_hash + PKCE verifier classes pinned to COLLATE "C".';

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
  if p_state_hash is null or p_state_hash collate "C" !~ '^[0-9a-f]{64}$' then
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

comment on function private.service_claim_gmail_oauth(text) is
  'MISE-005AD: claim Gmail OAuth; state_hash hex class pinned to COLLATE "C".';

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
  if p_state_hash is null or p_state_hash collate "C" !~ '^[0-9a-f]{64}$'
    or p_code_verifier is null or length(p_code_verifier) not between 43 and 128
    or p_code_verifier collate "C" !~ '^[A-Za-z0-9._~-]+$'
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

comment on function private.service_begin_square_oauth(uuid, uuid, uuid, text, text) is
  'MISE-005AD: begin Square OAuth; state_hash + PKCE verifier classes pinned to COLLATE "C".';

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
  if p_state_hash is null or p_state_hash collate "C" !~ '^[0-9a-f]{64}$' then
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

comment on function private.service_claim_square_oauth(text) is
  'MISE-005AD: claim Square OAuth; state_hash hex class pinned to COLLATE "C".';

revoke all on function private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_begin_gmail_oauth(uuid, uuid, uuid, text, text)
to service_role;

revoke all on function private.service_claim_gmail_oauth(text)
from public, anon, authenticated, service_role;
grant execute on function private.service_claim_gmail_oauth(text)
to service_role;

revoke all on function private.service_begin_square_oauth(uuid, uuid, uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_begin_square_oauth(uuid, uuid, uuid, text, text)
to service_role;

revoke all on function private.service_claim_square_oauth(text)
from public, anon, authenticated, service_role;
grant execute on function private.service_claim_square_oauth(text)
to service_role;
