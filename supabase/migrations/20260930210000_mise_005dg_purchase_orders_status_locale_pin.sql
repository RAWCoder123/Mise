-- MISE-005DG: pin public.purchase_orders.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist draft/submitted/received/cancelled.
--
-- purchase_orders.status stores purchase-order lifecycle vocabulary under a
-- bare IN allowlist from restaurant_ops_backbone:
--   status in ('draft', 'submitted', 'received', 'cancelled')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft'      — unsent purchase order awaiting submit
--   'submitted'  — order submitted to supplier / outbound workflow
--   'received'   — delivery received and closed
--   'cancelled'  — order cancelled without receiving
--
-- purchase_orders.status gates restaurant-ops indexes, demo/export reads,
-- and legacy purchase-order presentation. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open sibling pin #497 covers
-- supplier_orders.status (draft/sent/completed), but leaves
-- purchase_orders.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN purchase_orders.status CHECK,
-- dump/restore could accept purchase-order lifecycle bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking purchase-order continuity across restore.
--
-- Scope:
--   - Replace purchase_orders_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite purchase-order / supplier-order writers,
-- purchase_orders_operational_values_check, supplier_orders.status (#497),
-- ordering_policy (#518), or other bare-IN vocabularies.
-- Timestamp after MISE-005DF (#518).

alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (
    status in ('draft', 'submitted', 'received', 'cancelled')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint purchase_orders_status_check
  on public.purchase_orders is
  'MISE-005DG: exact draft/submitted/received/cancelled allowlist plus ASCII shape under COLLATE "C". Purchase order lifecycle state.';

comment on column public.purchase_orders.status is
  'Purchase order lifecycle. Allowed values: draft, submitted, received, cancelled under COLLATE "C".';
