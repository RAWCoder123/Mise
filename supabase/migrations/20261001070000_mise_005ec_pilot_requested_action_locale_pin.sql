-- MISE-005EC: pin private.pilot_operational_control_changes.requested_action
-- CHECK to COLLATE "C", preserving the exact-token allowlist.
--
-- private.pilot_operational_control_changes stores founder pilot control
-- requested_action under a bare IN allowlist from mise_pilot_001_atomic_controls:
--   requested_action in (
--     'enable-square-sync',
--     'enable-square-webhooks',
--     'enable-order-drafting',
--     'enable-gmail-delivery',
--     'disable-square',
--     'disable-order-drafting',
--     'disable-gmail-delivery',
--     'disable-external',
--     'pause-integrations',
--     'resume-normal'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'enable-square-sync'       — enable Square sales sync
--   'enable-square-webhooks'   — enable Square webhook intake
--   'enable-order-drafting'    — enable supplier order drafting
--   'enable-gmail-delivery'    — enable Gmail supplier delivery
--   'disable-square'           — disable Square sync and webhooks
--   'disable-order-drafting'   — disable supplier order drafting
--   'disable-gmail-delivery'   — disable Gmail supplier delivery
--   'disable-external'         — disable all external integrations
--   'pause-integrations'       — pause integrations via system_mode
--   'resume-normal'            — resume normal operational mode
--
-- requested_action is durable evidence on every atomic pilot control change.
-- POSIX character classes follow database LC_CTYPE. This cluster runs libc
-- en_US.UTF-8. MISE-005A proved locale drift on this cluster; open tip #536
-- pinned pilot control_domain but explicitly left requested_action on bare IN.
-- Open tip #540 covers operational_mode_changes prior/next_mode, not this
-- pilot evidence column.
--
-- If LC_CTYPE drifted under a bare-IN requested_action CHECK, dump/restore
-- could accept pilot-control action bytes the restored C-locale path
-- (and sibling pilot / operational-mode gates) would refuse — or the reverse —
-- breaking pilot control evidence continuity across restore.
--
-- Scope:
--   - Replace pilot_operational_control_changes_requested_action_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_apply_pilot_operational_control, control_domain
-- allowlist (#536), reason_code shape, system_operational_controls.operational_mode
-- (#517), operational_mode_changes prior/next_mode (#540), or
-- restaurant_operational_controls writers. Timestamp after MISE-005EB (#540).

alter table private.pilot_operational_control_changes
  drop constraint if exists pilot_operational_control_changes_requested_action_check;

alter table private.pilot_operational_control_changes
  add constraint pilot_operational_control_changes_requested_action_check
  check (
    requested_action in (
      'enable-square-sync',
      'enable-square-webhooks',
      'enable-order-drafting',
      'enable-gmail-delivery',
      'disable-square',
      'disable-order-drafting',
      'disable-gmail-delivery',
      'disable-external',
      'pause-integrations',
      'resume-normal'
    )
    and requested_action collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pilot_operational_control_changes_requested_action_check
  on private.pilot_operational_control_changes is
  'MISE-005EC: exact enable-/disable-/pause-/resume-normal allowlist plus ASCII shape under COLLATE "C". Pilot operational control requested_action.';

comment on column private.pilot_operational_control_changes.requested_action is
  'Pilot operational control requested action. Allowed values: enable-square-sync, enable-square-webhooks, enable-order-drafting, enable-gmail-delivery, disable-square, disable-order-drafting, disable-gmail-delivery, disable-external, pause-integrations, resume-normal under COLLATE "C".';
