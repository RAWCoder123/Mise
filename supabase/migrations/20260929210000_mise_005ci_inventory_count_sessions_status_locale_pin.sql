-- MISE-005CI: pin inventory_count_sessions.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist
-- in_progress/submitted/approved/cancelled.
--
-- inventory_count_sessions.status stores count-session lifecycle vocabulary
-- under a bare IN allowlist from inventory_count_sessions_ledger:
--   status in ('in_progress', 'submitted', 'approved', 'cancelled')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'in_progress' — open count session, lines still editable
--   'submitted'   — count submitted for manager review
--   'approved'    — manager approved; count events applied to ledger
--   'cancelled'   — session abandoned without applying counts
--
-- inventory_count_sessions.status gates the one-open-session unique index
-- (in_progress/submitted), submit/approve/cancel RPCs, and count-event
-- projection. Consistency CHECKs bind timestamps to status. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pins cover
-- recipe_versions.status (#494), verification_status (#493),
-- inventory_events.event_type (#492), and canonical_unit (#490/#491), but
-- leave inventory_count_sessions.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN inventory_count_sessions.status CHECK,
-- dump/restore could accept lifecycle-state bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the
-- reverse — breaking count-session authority continuity across restore.
--
-- Scope:
--   - Replace inventory_count_sessions_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite count begin/submit/approve/cancel writers,
-- recipe_versions.status (#494), verification_status (#493),
-- inventory_events.event_type (#492), canonical_unit pins (#490/#491),
-- consistency timestamp CHECKs, or free-form notes.
-- Timestamp after MISE-005CH (#494).

alter table public.inventory_count_sessions
  drop constraint if exists inventory_count_sessions_status_check;

alter table public.inventory_count_sessions
  add constraint inventory_count_sessions_status_check
  check (
    status in ('in_progress', 'submitted', 'approved', 'cancelled')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint inventory_count_sessions_status_check
  on public.inventory_count_sessions is
  'MISE-005CI: exact in_progress/submitted/approved/cancelled allowlist plus ASCII shape under COLLATE "C". Count session lifecycle state.';

comment on column public.inventory_count_sessions.status is
  'Count session lifecycle state. Allowed values: in_progress, submitted, approved, cancelled under COLLATE "C".';
