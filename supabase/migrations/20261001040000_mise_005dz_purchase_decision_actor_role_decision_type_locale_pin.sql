-- MISE-005DZ: pin public.purchase_decision_events.actor_role and
-- public.purchase_decision_events.decision_type CHECKs to COLLATE "C",
-- preserving the exact-token allowlists.
--
-- Purchase decision memory vocabulary columns store actor role and
-- decision type under bare IN allowlists from MISE-004A:
--   actor_role in ('owner', 'admin', 'manager')
--   decision_type in (
--     'approve', 'approve_with_override', 'dismiss', 'undo',
--     'exclude_from_learning'
--   )
-- Those allowlists are exact string equality and carry no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   actor_role:    'owner' | 'admin' | 'manager'
--   decision_type: 'approve' | 'approve_with_override' | 'dismiss' |
--                  'undo' | 'exclude_from_learning'
--
-- actor_role gates who may leave purchase-decision evidence.
-- decision_type gates base vs compensation shape
-- (purchase_decision_events_shape_check) and pattern outcome buckets.
-- POSIX character classes follow database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A proved locale drift on this cluster; open
-- tips #451/#482 pin source_event_key / evidence_version on the same
-- table but left actor_role and decision_type on bare IN. Open tips
-- #490/#491 pin canonical_unit. Finding-decision decision_type is a
-- different table (#537).
--
-- If LC_CTYPE drifted under a bare-IN purchase-decision vocabulary CHECK,
-- dump/restore could accept role or decision-type bytes the restored
-- C-locale path (and sibling purchase-decision gates) would refuse — or
-- the reverse — breaking purchase-decision evidence continuity across
-- restore.
--
-- Scope:
--   - Replace purchase_decision_events_actor_role_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
--   - Replace purchase_decision_events_decision_type_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite record_purchase_decision_* writers,
-- purchase_decision_actor_role, purchase_decision_events_shape_check,
-- source_event_key (#451), evidence_version (#482), canonical_unit
-- (#490/#491), recommendation_source, or finding-decision decision_type
-- (#537).
-- Timestamp after MISE-005DY (#537).

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_actor_role_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_actor_role_check
  check (
    actor_role in ('owner', 'admin', 'manager')
    and actor_role collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_decision_events_actor_role_check
  on public.purchase_decision_events is
  'MISE-005DZ: exact owner/admin/manager allowlist plus ASCII shape under COLLATE "C". Purchase decision actor role vocabulary.';

comment on column public.purchase_decision_events.actor_role is
  'Purchase decision actor role. Allowed values: owner, admin, manager under COLLATE "C".';

alter table public.purchase_decision_events
  drop constraint if exists purchase_decision_events_decision_type_check;

alter table public.purchase_decision_events
  add constraint purchase_decision_events_decision_type_check
  check (
    decision_type in (
      'approve',
      'approve_with_override',
      'dismiss',
      'undo',
      'exclude_from_learning'
    )
    and decision_type collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_decision_events_decision_type_check
  on public.purchase_decision_events is
  'MISE-005DZ: exact approve/approve_with_override/dismiss/undo/exclude_from_learning allowlist plus ASCII shape under COLLATE "C". Purchase decision type vocabulary.';

comment on column public.purchase_decision_events.decision_type is
  'Purchase decision type. Allowed values: approve, approve_with_override, dismiss, undo, exclude_from_learning under COLLATE "C".';
