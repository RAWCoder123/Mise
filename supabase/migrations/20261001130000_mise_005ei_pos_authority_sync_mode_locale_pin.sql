-- MISE-005EI: pin public.pos_integrations.authority_sync_mode CHECK
-- vocabulary inside pos_integrations_authority_sync_state_check to
-- COLLATE "C", preserving the exact-token allowlist and idle/active
-- state machine.
--
-- public.pos_integrations stores Square authority-sync mode under a bare
-- IN allowlist from the MISE-003A authority correction:
--   authority_sync_mode in ('full', 'partial')
-- when an authority sync lease is active; otherwise the entire sync-state
-- tuple must be null. That allowlist is exact string equality and carries
-- no dedicated ASCII shape gate under COLLATE "C". Writers mint durable
-- ASCII tokens only:
--   'full'    — may attest the exact current 28-day purchasing window
--   'partial' — always invalidates purchasing completeness
--
-- authority_sync_mode is the durable vocabulary on the database-visible
-- Square synchronization boundary that purchase approval blocks against.
-- POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- tips #473 (sync_cursor), #476 (sync_cursor writer cntrl), #465
-- (pos_locations.external_location_id), #523 (connection provider), and
-- #500 (connection status) leave authority_sync_mode on bare IN inside
-- the compound state CHECK.
--
-- If LC_CTYPE drifted under a bare-IN authority_sync_mode CHECK,
-- dump/restore could accept sync-mode vocabulary bytes the restored
-- C-locale path (and sibling POS identity gates) would refuse — or the
-- reverse — breaking purchase-authority sync continuity across restore.
--
-- Scope:
--   - Replace pos_integrations_authority_sync_state_check preserving
--     idle-all-null / active-all-present semantics PLUS ASCII shape on
--     authority_sync_mode under COLLATE "C"
-- Does NOT rewrite prepare_square / apply_square sync writers (#429),
-- sync_cursor (#473/#476), external_location_id (#465/#BF), connection
-- provider (#523), connection status (#500), or purchase-approval
-- mutators.
-- Timestamp after MISE-005EH (#546).

alter table public.pos_integrations
  drop constraint if exists pos_integrations_authority_sync_state_check;

alter table public.pos_integrations
  add constraint pos_integrations_authority_sync_state_check check (
    (
      authority_sync_token is null
      and authority_sync_started_at is null
      and authority_sync_mode is null
      and authority_sync_window_from is null
      and authority_sync_window_to is null
      and authority_sync_location_ids is null
    )
    or (
      authority_sync_token is not null
      and authority_sync_started_at is not null
      and authority_sync_mode in ('full', 'partial')
      and authority_sync_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
      and authority_sync_window_from is not null
      and authority_sync_window_to is not null
      and authority_sync_window_to >= authority_sync_window_from
      and authority_sync_location_ids is not null
      and cardinality(authority_sync_location_ids) > 0
    )
  );

comment on constraint pos_integrations_authority_sync_state_check
  on public.pos_integrations is
  'MISE-005EI: idle-all-null or active lease with exact full/partial authority_sync_mode allowlist plus ASCII shape under COLLATE "C".';

comment on column public.pos_integrations.authority_sync_mode is
  'Authority sync mode while a lease is active. Allowed values: full, partial under COLLATE "C". Null when idle.';
