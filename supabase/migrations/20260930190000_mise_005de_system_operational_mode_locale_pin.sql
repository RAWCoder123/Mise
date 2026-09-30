-- MISE-005DE: pin public.system_operational_controls.operational_mode CHECK
-- to COLLATE "C", preserving the exact-token allowlist
-- normal/read_only/integrations_paused/emergency.
--
-- system_operational_controls.operational_mode stores the global restaurant
-- mutation authority vocabulary under a bare IN allowlist from
-- operational_data_foundation_inventory_ledger:
--   operational_mode in (
--     'normal', 'read_only', 'integrations_paused', 'emergency'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'normal'                — ordinary authenticated mutations allowed
--   'read_only'             — authenticated writes blocked
--   'integrations_paused'   — provider claims and sync paused
--   'emergency'             — emergency halt of authenticated mutations
--
-- operational_mode gates enforce_authenticated_operational_mode, provider
-- kill-switch claims, supplier-send integrity, Square OAuth sync, and
-- service_set_system_operational_mode transitions. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; open sibling pin #434 covers the
-- reason_code shape on the mutator, but leave the table CHECK itself on
-- bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN operational_mode CHECK, dump/restore
-- could accept emergency-mode vocabulary bytes the restored C-locale path
-- (and sibling machine-identity gates) would refuse — or the reverse —
-- breaking operational-mode authority across restore.
--
-- Scope:
--   - Replace system_operational_controls_operational_mode_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_set_system_operational_mode (#434), ordering_policy
-- CHECKs, restaurant_operational_controls (no operational_mode column),
-- pilot control writers, or private.operational_mode_changes.
-- Timestamp after MISE-005DD (#516).

alter table public.system_operational_controls
  drop constraint if exists system_operational_controls_operational_mode_check;

alter table public.system_operational_controls
  add constraint system_operational_controls_operational_mode_check
  check (
    operational_mode in ('normal', 'read_only', 'integrations_paused', 'emergency')
    and operational_mode collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint system_operational_controls_operational_mode_check
  on public.system_operational_controls is
  'MISE-005DE: exact normal/read_only/integrations_paused/emergency allowlist plus ASCII shape under COLLATE "C". Global operational mutation authority.';

comment on column public.system_operational_controls.operational_mode is
  'Global operational mutation authority. Allowed values: normal, read_only, integrations_paused, emergency under COLLATE "C".';
