-- MISE-005ED: pin private.pilot_operational_control_changes.backend_identity
-- CHECK to COLLATE "C", preserving the exact equality token service_role_rpc.
--
-- private.pilot_operational_control_changes stores founder pilot control
-- backend_identity under a bare equality CHECK from mise_pilot_001_atomic_controls:
--   backend_identity text not null default 'service_role_rpc'
--     check (backend_identity = 'service_role_rpc')
-- That equality is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint the durable ASCII token only:
--   'service_role_rpc' — evidence row authored through the service-role RPC path
--
-- backend_identity is durable evidence that every atomic pilot control change
-- was recorded by the service-owned RPC path, not by a client or alternate
-- backend identity. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- open tip #541 pinned pilot requested_action and open tip #536 pinned
-- control_domain, but both explicitly left backend_identity on bare equality.
--
-- If LC_CTYPE drifted under a bare-equality backend_identity CHECK, dump/restore
-- could accept pilot backend-identity bytes the restored C-locale path
-- (and sibling pilot / operational-mode gates) would refuse — or the reverse —
-- breaking pilot control evidence continuity across restore.
--
-- Scope:
--   - Replace pilot_operational_control_changes_backend_identity_check with
--     exact equality PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_apply_pilot_operational_control (#433),
-- requested_action (#541), control_domain (#536), reason_code (#448/#434),
-- system_operational_controls.operational_mode (#517), or
-- operational_mode_changes prior/next (#540). Timestamp after MISE-005EC (#541).

alter table private.pilot_operational_control_changes
  drop constraint if exists pilot_operational_control_changes_backend_identity_check;

alter table private.pilot_operational_control_changes
  add constraint pilot_operational_control_changes_backend_identity_check
  check (
    backend_identity = 'service_role_rpc'
    and backend_identity collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint pilot_operational_control_changes_backend_identity_check
  on private.pilot_operational_control_changes is
  'MISE-005ED: exact service_role_rpc equality plus ASCII shape under COLLATE "C". Pilot operational control backend_identity.';

comment on column private.pilot_operational_control_changes.backend_identity is
  'Pilot operational control backend identity. Allowed value: service_role_rpc under COLLATE "C".';
