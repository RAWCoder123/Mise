-- MISE-005DK: pin pos_integrations.provider and
-- restaurant_email_connections.provider CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- Connection provider columns store integration-provider vocabulary under
-- bare IN allowlists from the ops backbone and email scaffolding:
--   pos_integrations.provider in
--     ('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo')
--   restaurant_email_connections.provider in
--     ('gmail')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   POS:   'square' | 'toast' | 'clover' | 'lightspeed' | 'manual_csv' | 'demo'
--   Email: 'gmail'
--
-- Connection provider gates OAuth routing, sync adapters, unique
-- (restaurant_id, provider) identity, pilot readiness, and activity
-- metadata. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pin #500 covers connection status only and leaves
-- provider columns on bare IN. Open sibling pins for POS identity and
-- sync_cursor (#466/#473) and Gmail subject (#464) also leave provider
-- vocabulary unpinned.
--
-- If LC_CTYPE drifted under a bare-IN connection provider CHECK,
-- dump/restore could accept provider-identity bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking reconnect and provider routing continuity
-- across restore.
--
-- Scope:
--   - Replace pos_integrations_provider_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
--   - Replace restaurant_email_connections_provider_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite OAuth fail/complete RPCs, connection status (#500),
-- sync_cursor (#473), external_location_id (#466), Gmail
-- provider_subject (#464), free-form sender_email / error payloads, or
-- other bare-IN vocabularies (purchase_lines, outreach
-- generation_provider).
-- Timestamp after MISE-005DJ (#522).

alter table public.pos_integrations
  drop constraint if exists pos_integrations_provider_check;

alter table public.pos_integrations
  add constraint pos_integrations_provider_check
  check (
    provider in ('square', 'toast', 'clover', 'lightspeed', 'manual_csv', 'demo')
    and provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pos_integrations_provider_check
  on public.pos_integrations is
  'MISE-005DK: exact square/toast/clover/lightspeed/manual_csv/demo allowlist plus ASCII shape under COLLATE "C". POS integration provider identity.';

comment on column public.pos_integrations.provider is
  'POS integration provider identity. Allowed values: square, toast, clover, lightspeed, manual_csv, demo under COLLATE "C".';

alter table public.restaurant_email_connections
  drop constraint if exists restaurant_email_connections_provider_check;

alter table public.restaurant_email_connections
  add constraint restaurant_email_connections_provider_check
  check (
    provider in ('gmail')
    and provider collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint restaurant_email_connections_provider_check
  on public.restaurant_email_connections is
  'MISE-005DK: exact gmail allowlist plus ASCII shape under COLLATE "C". Email connection provider identity.';

comment on column public.restaurant_email_connections.provider is
  'Email connection provider identity. Allowed values: gmail under COLLATE "C".';
