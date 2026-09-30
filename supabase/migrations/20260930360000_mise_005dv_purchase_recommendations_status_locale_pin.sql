-- MISE-005DV: pin public.purchase_recommendations.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- public.purchase_recommendations stores purchase-recommendation lifecycle
-- under a bare IN allowlist from secure_multi_tenant_rls:
--   status in ('pending', 'approved', 'dismissed', 'ordered')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'pending'   — awaiting manager approve / dismiss / order action
--   'approved'  — approved into purchase / supplier-order workflow
--   'dismissed' — explicitly dismissed without ordering
--   'ordered'   — converted into an outbound supplier order
--
-- purchase_recommendations.status gates MISE-003A approval authority,
-- pending-replacement RPCs, decision-memory evidence, and tenant workflow
-- indexes. POSIX character classes follow database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- open sibling pins through #533 leave purchase_recommendations.status on
-- bare IN. Open tip #519 pinned purchase_orders.status and deferred this
-- recommendation lifecycle column.
--
-- If LC_CTYPE drifted under a bare-IN purchase_recommendations.status
-- CHECK, dump/restore could accept recommendation-status bytes the restored
-- C-locale path (and sibling purchase/approval gates) would refuse — or
-- the reverse — breaking purchase-recommendation continuity across restore.
--
-- Scope:
--   - Replace purchase_recommendations_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite purchase-approval / dismiss / undo RPCs, generation_source
-- (#484), urgency allowlist, purchase_orders.status (#519), or
-- purchase_decision_events writers. Timestamp after MISE-005DU (#533).

alter table public.purchase_recommendations
  drop constraint if exists purchase_recommendations_status_check;

alter table public.purchase_recommendations
  add constraint purchase_recommendations_status_check
  check (
    status in (
      'pending',
      'approved',
      'dismissed',
      'ordered'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_recommendations_status_check
  on public.purchase_recommendations is
  'MISE-005DV: exact pending/approved/dismissed/ordered allowlist plus ASCII shape under COLLATE "C". Purchase recommendation lifecycle state.';

comment on column public.purchase_recommendations.status is
  'Purchase recommendation lifecycle. Allowed values: pending, approved, dismissed, ordered under COLLATE "C".';
