-- MISE-005EB: pin private.operational_mode_changes.prior_mode and
-- private.operational_mode_changes.next_mode CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- Emergency operational-mode history stores prior_mode and next_mode under
-- bare IN allowlists from enforce_emergency_operational_mode:
--   prior_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
--   next_mode  in ('normal', 'read_only', 'integrations_paused', 'emergency')
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'normal'                — ordinary authenticated mutations allowed
--   'read_only'             — authenticated writes blocked
--   'integrations_paused'   — provider claims and sync paused
--   'emergency'             — emergency halt of authenticated mutations
--
-- prior_mode / next_mode are the append-only emergency change-log vocabulary
-- that service_set_system_operational_mode records when authority transitions.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open tip #517
-- pins system_operational_controls.operational_mode but explicitly left
-- private.operational_mode_changes on bare IN. Open tip #434 covers
-- reason_code shape on the mutator, not these history columns.
--
-- If LC_CTYPE drifted under a bare-IN emergency change-log vocabulary CHECK,
-- dump/restore could accept prior/next mode bytes the restored C-locale path
-- (and sibling operational-mode gates) would refuse — or the reverse —
-- breaking emergency mode-history continuity across restore.
--
-- Scope:
--   - Replace operational_mode_changes_prior_mode_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace operational_mode_changes_next_mode_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_set_system_operational_mode (#434),
-- system_operational_controls.operational_mode (#517), reason_code,
-- pilot requested_action, or restaurant_operational_controls.
-- Timestamp after MISE-005EA (#539).

alter table private.operational_mode_changes
  drop constraint if exists operational_mode_changes_prior_mode_check;

alter table private.operational_mode_changes
  add constraint operational_mode_changes_prior_mode_check
  check (
    prior_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
    and prior_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_mode_changes_prior_mode_check
  on private.operational_mode_changes is
  'MISE-005EB: exact normal/read_only/integrations_paused/emergency allowlist plus ASCII shape under COLLATE "C". Emergency change-log prior_mode vocabulary.';

comment on column private.operational_mode_changes.prior_mode is
  'Emergency change-log prior operational mode. Allowed values: normal, read_only, integrations_paused, emergency under COLLATE "C".';

alter table private.operational_mode_changes
  drop constraint if exists operational_mode_changes_next_mode_check;

alter table private.operational_mode_changes
  add constraint operational_mode_changes_next_mode_check
  check (
    next_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
    and next_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint operational_mode_changes_next_mode_check
  on private.operational_mode_changes is
  'MISE-005EB: exact normal/read_only/integrations_paused/emergency allowlist plus ASCII shape under COLLATE "C". Emergency change-log next_mode vocabulary.';

comment on column private.operational_mode_changes.next_mode is
  'Emergency change-log next operational mode. Allowed values: normal, read_only, integrations_paused, emergency under COLLATE "C".';
