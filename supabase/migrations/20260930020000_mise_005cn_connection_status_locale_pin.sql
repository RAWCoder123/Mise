-- MISE-005CN: pin pos_integrations.status and
-- restaurant_email_connections.status CHECKs to COLLATE "C", preserving
-- the exact-token allowlists.
--
-- Connection status columns store integration lifecycle vocabulary under
-- bare IN allowlists from the ops backbone and email scaffolding:
--   pos_integrations.status in
--     ('not_connected', 'connected', 'paused', 'error')
--   restaurant_email_connections.status in
--     ('not_connected', 'connected', 'needs_reauth', 'restricted')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   POS:   'not_connected' | 'connected' | 'paused' | 'error'
--   Email: 'not_connected' | 'connected' | 'needs_reauth' | 'restricted'
--
-- Connection status gates OAuth fail/reconnect flows, readiness checks,
-- supplier-send blockers, pilot controls, and activity routing. POSIX
-- character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open sibling
-- pins cover POS identity and sync_cursor (#466/#473) and Gmail subject
-- (#464), but leave connection status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN connection status CHECK,
-- dump/restore could accept connection-lifecycle bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking reconnect and readiness continuity across restore.
--
-- Scope:
--   - Replace pos_integrations_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_email_connections_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite OAuth fail/complete RPCs, provider columns, sync_cursor
-- (#473), external_location_id (#466), Gmail provider_subject (#464),
-- restaurant_tasks.status (#498), supplier_orders.status (#497), or
-- free-form sender_email / error payloads.
-- Timestamp after MISE-005CM (#499).

alter table public.pos_integrations
  drop constraint if exists pos_integrations_status_check;

alter table public.pos_integrations
  add constraint pos_integrations_status_check
  check (
    status in ('not_connected', 'connected', 'paused', 'error')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pos_integrations_status_check
  on public.pos_integrations is
  'MISE-005CN: exact not_connected/connected/paused/error allowlist plus ASCII shape under COLLATE "C". POS integration connection lifecycle.';

comment on column public.pos_integrations.status is
  'POS integration connection lifecycle. Allowed values: not_connected, connected, paused, error under COLLATE "C".';

alter table public.restaurant_email_connections
  drop constraint if exists restaurant_email_connections_status_check;

alter table public.restaurant_email_connections
  add constraint restaurant_email_connections_status_check
  check (
    status in ('not_connected', 'connected', 'needs_reauth', 'restricted')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_email_connections_status_check
  on public.restaurant_email_connections is
  'MISE-005CN: exact not_connected/connected/needs_reauth/restricted allowlist plus ASCII shape under COLLATE "C". Email connection lifecycle.';

comment on column public.restaurant_email_connections.status is
  'Email connection lifecycle. Allowed values: not_connected, connected, needs_reauth, restricted under COLLATE "C".';
