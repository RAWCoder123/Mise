-- MISE-005O: pin Gmail credentials sender_email shape + OAuth fail-closed to COLLATE "C".
--
-- private.gmail_credentials.sender_email still stores the connected From address
-- with:
--   sender_email = lower(sender_email)
--   sender_email !~ '[[:cntrl:]]'
-- and no mailbox shape. private.service_complete_gmail_oauth mirrors that with
-- bare lower(trim(...)), bare [[:cntrl:]], and bare [[:space:]] shape.
-- lower() and POSIX classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; MISE-005J
-- re-pinned the cntrl half of this CHECK but left lower() and shape bare for
-- a sibling tip (same pattern as MISE-005K → MISE-005N for recipients).
--
-- sender_email is the durable Gmail From on every connected restaurant. If
-- LC_CTYPE drifted under bare lower/[[:space:]]/[[:cntrl:]], dump/restore
-- could reject credential rows the source accepted — and the OAuth complete
-- preflight could accept a mailbox the CHECK would reject (or the reverse),
-- breaking reconnect and supplier-send From continuity.
--
-- Scope:
--   - Reattach gmail_credentials_sender_email_check with COLLATE "C" lower,
--     cntrl, and [[:space:]] mailbox shape
--   - Rewrite private.service_complete_gmail_oauth fail-closed to the same
--     COLLATE "C" contract
-- Does NOT rewrite supplier_email_deliveries metadata CHECKs (MISE-005J) or
-- claim / approve / complete send RPCs.

alter table private.gmail_credentials
  drop constraint if exists gmail_credentials_sender_email_check;

alter table private.gmail_credentials
  add constraint gmail_credentials_sender_email_check
    check (
      pg_catalog.length(sender_email) between 3 and 254
      and sender_email = pg_catalog.btrim(sender_email)
      and sender_email = pg_catalog.lower(sender_email collate "C") collate "C"
      and sender_email collate "C" !~ '[[:cntrl:]]'
      and sender_email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    );

comment on constraint gmail_credentials_sender_email_check
  on private.gmail_credentials is
  'MISE-005O: sender_email length 3–254, trimmed, C-locale lower, ASCII C [[:cntrl:]] + [[:space:]] shape (COLLATE "C").';

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
  normalized_email text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_sender_email, '')) collate "C"
  ) collate "C";
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
  if p_provider_subject is null or pg_catalog.length(p_provider_subject) not between 1 and 255
    or pg_catalog.length(normalized_email) not between 3 and 254
    or normalized_email collate "C" ~ '[[:cntrl:]]'
    or normalized_email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_credential_material is null or pg_catalog.length(p_credential_material) not between 8 and 4096
    or p_granted_scopes is null
    or pg_catalog.cardinality(p_granted_scopes) not between 1 and 10
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

comment on function private.service_complete_gmail_oauth(uuid, text, text, text, text[]) is
  'MISE-005O: service-role Gmail OAuth completion. sender_email lower/cntrl/shape pinned to COLLATE "C".';

revoke all on function private.service_complete_gmail_oauth(uuid, text, text, text, text[])
from public, anon, authenticated, service_role;
grant execute on function private.service_complete_gmail_oauth(uuid, text, text, text, text[])
to service_role;
