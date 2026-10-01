-- MISE-005DX: pin private.pilot_operational_control_changes.control_domain
-- CHECK to COLLATE "C", preserving the exact-token allowlist.
--
-- private.pilot_operational_control_changes stores founder pilot control
-- domain under a bare IN allowlist from mise_pilot_001_atomic_controls:
--   control_domain in ('square', 'drafting', 'gmail', 'external', 'system_mode')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'square'      — Square sync / webhook enablement and kill-switch
--   'drafting'    — supplier order drafting enablement and kill-switch
--   'gmail'       — Gmail delivery enablement and kill-switch
--   'external'    — combined external-integration disable
--   'system_mode' — pause-integrations / resume-normal transitions
--
-- control_domain is durable evidence on every atomic pilot control change and
-- is derived from requested_action before append. POSIX character classes
-- follow database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A
-- proved locale drift on this cluster; open sibling pins through #535 leave
-- pilot control_domain on bare IN. Open tip #517 pinned
-- system_operational_controls.operational_mode and deferred this private
-- evidence column.
--
-- If LC_CTYPE drifted under a bare-IN control_domain CHECK, dump/restore
-- could accept pilot-control domain bytes the restored C-locale path
-- (and sibling operational-mode / pilot gates) would refuse — or the reverse —
-- breaking pilot control evidence continuity across restore.
--
-- Scope:
--   - Replace pilot_operational_control_changes_control_domain_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_apply_pilot_operational_control, requested_action
-- allowlist, reason_code shape, system_operational_controls.operational_mode
-- (#517), or restaurant_operational_controls writers. Timestamp after
-- MISE-005DW (#535).

alter table private.pilot_operational_control_changes
  drop constraint if exists pilot_operational_control_changes_control_domain_check;

alter table private.pilot_operational_control_changes
  add constraint pilot_operational_control_changes_control_domain_check
  check (
    control_domain in (
      'square',
      'drafting',
      'gmail',
      'external',
      'system_mode'
    )
    and control_domain collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pilot_operational_control_changes_control_domain_check
  on private.pilot_operational_control_changes is
  'MISE-005DX: exact square/drafting/gmail/external/system_mode allowlist plus ASCII shape under COLLATE "C". Pilot operational control domain.';

comment on column private.pilot_operational_control_changes.control_domain is
  'Pilot operational control domain. Allowed values: square, drafting, gmail, external, system_mode under COLLATE "C".';
