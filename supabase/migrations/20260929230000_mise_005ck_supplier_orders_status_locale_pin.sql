-- MISE-005CK: pin supplier_orders.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist draft/sent/completed.
--
-- supplier_orders.status stores supplier-order lifecycle vocabulary under a
-- bare IN allowlist from secure_multi_tenant_rls:
--   status in ('draft', 'sent', 'completed')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'draft'     — unsent purchase/order draft awaiting approval or send
--   'sent'      — supplier-facing send completed (or marked sent)
--   'completed' — order fully received / closed
--
-- supplier_orders.status gates draft uniqueness, send-content blockers,
-- delivery completion, activity routing (order_sent vs delivery_logged),
-- and operating-plan / today-task urgency. POSIX character classes follow
-- database LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved
-- locale drift on this cluster; open sibling pins cover recalculation_runs
-- status (#496) and inventory_count_sessions.status (#495), but leave
-- supplier_orders.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN supplier_orders.status CHECK,
-- dump/restore could accept order-lifecycle bytes the restored C-locale
-- path (and sibling machine-identity gates) would refuse — or the
-- reverse — breaking send/receive continuity across restore.
--
-- Scope:
--   - Replace supplier_orders_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite supplier-send / purchase-approval writers, email
-- delivery claims, operational_values / purchase_authority / send_content
-- CHECKs, restaurant_tasks.status, recalculation_runs.status (#496),
-- inventory_count_sessions.status (#495), or free-form order_message.
-- Timestamp after MISE-005CJ (#496).

alter table public.supplier_orders
  drop constraint if exists supplier_orders_status_check;

alter table public.supplier_orders
  add constraint supplier_orders_status_check
  check (
    status in ('draft', 'sent', 'completed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_orders_status_check
  on public.supplier_orders is
  'MISE-005CK: exact draft/sent/completed allowlist plus ASCII shape under COLLATE "C". Supplier order lifecycle state.';

comment on column public.supplier_orders.status is
  'Supplier order lifecycle. Allowed values: draft, sent, completed under COLLATE "C".';
