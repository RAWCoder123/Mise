-- MISE-005DB: pin supplier_deliveries.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist
-- unverified/partially_received/received/discrepancy/failed.
--
-- supplier_deliveries.status stores receiving-lifecycle vocabulary under a
-- bare IN allowlist from operational_backend_foundation:
--   status in (
--     'unverified', 'partially_received', 'received', 'discrepancy', 'failed'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'unverified'         — delivery row created before verification completes
--   'partially_received' — some ordered lines still outstanding
--   'received'           — clean full receive
--   'discrepancy'        — shortage, damage, or substitution recorded
--   'failed'             — receive attempt could not be completed
--
-- status gates order completion (received closes sent supplier_orders),
-- action-outcome expected/actual deliveryStatus matching, reliability
-- memory lessons, and activity routing (delivery_logged vs
-- invoice_discrepancy_detected). POSIX character classes follow database
-- LC_CTYPE. This cluster runs libc en_US.UTF-8. MISE-005A proved locale
-- drift on this cluster; open sibling pins cover supplier_deliveries
-- identity (#458) and supplier_orders.status (#497), but leave
-- supplier_deliveries.status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN status CHECK, dump/restore could
-- accept receiving-lifecycle bytes the restored C-locale path (and
-- sibling machine-identity gates) would refuse — or the reverse —
-- breaking delivery continuity across restore.
--
-- Scope:
--   - Replace supplier_deliveries_status_check with exact-token allowlist
--     PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_receive_supplier_order writers, delivery
-- identity CHECKs (#458), supplier_orders.status (#497),
-- supplier_order_confirmations.confirmation_status (#513), delivery
-- notes free-form fields, or activity_events vocabulary (#512).
-- Timestamp after MISE-005DA (#513).

alter table public.supplier_deliveries
  drop constraint if exists supplier_deliveries_status_check;

alter table public.supplier_deliveries
  add constraint supplier_deliveries_status_check
  check (
    status in ('unverified', 'partially_received', 'received', 'discrepancy', 'failed')
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_deliveries_status_check
  on public.supplier_deliveries is
  'MISE-005DB: exact unverified/partially_received/received/discrepancy/failed allowlist plus ASCII shape under COLLATE "C". Supplier delivery receiving lifecycle state.';

comment on column public.supplier_deliveries.status is
  'Supplier delivery receiving lifecycle. Allowed values: unverified, partially_received, received, discrepancy, failed under COLLATE "C".';
