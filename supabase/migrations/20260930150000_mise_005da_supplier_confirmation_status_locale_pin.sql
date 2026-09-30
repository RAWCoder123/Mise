-- MISE-005DA: pin supplier_order_confirmations.confirmation_status CHECK
-- to COLLATE "C", preserving the exact-token allowlist
-- acknowledged/changed/rejected/unverified.
--
-- supplier_order_confirmations.confirmation_status stores supplier-order
-- confirmation vocabulary under a bare IN allowlist from
-- operational_backend_foundation:
--   confirmation_status in (
--     'acknowledged', 'changed', 'rejected', 'unverified'
--   )
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'acknowledged' — supplier accepted the order as sent
--   'changed'      — supplier confirmed with material changes
--   'rejected'     — supplier refused the order
--   'unverified'   — confirmation received but could not be verified
--
-- confirmation_status gates confirmation ingestion validity, activity
-- routing (confirmed vs could_not_verify), and operating-plan delivery
-- expectation. POSIX character classes follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; open sibling pins cover supplier_order_confirmations
-- idempotency_key (#459) and supplier_orders.status (#497), but leave
-- confirmation_status on bare IN only.
--
-- If LC_CTYPE drifted under a bare-IN confirmation_status CHECK,
-- dump/restore could accept confirmation-lifecycle bytes the restored
-- C-locale path (and sibling machine-identity gates) would refuse — or
-- the reverse — breaking confirmation continuity across restore.
--
-- Scope:
--   - Replace supplier_order_confirmations_confirmation_status_check with
--     exact-token allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite service_record_supplier_confirmation writers,
-- confirmation_reference /
-- source / normalized_details free-form fields, idempotency_key (#459),
-- supplier_orders.status (#497), supplier_deliveries.status, or
-- activity_events vocabulary (#512).
-- Timestamp after MISE-005CZ (#512).

alter table public.supplier_order_confirmations
  drop constraint if exists supplier_order_confirmations_confirmation_status_check;

alter table public.supplier_order_confirmations
  add constraint supplier_order_confirmations_confirmation_status_check
  check (
    confirmation_status in ('acknowledged', 'changed', 'rejected', 'unverified')
    and confirmation_status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_order_confirmations_confirmation_status_check
  on public.supplier_order_confirmations is
  'MISE-005DA: exact acknowledged/changed/rejected/unverified allowlist plus ASCII shape under COLLATE "C". Supplier confirmation lifecycle state.';

comment on column public.supplier_order_confirmations.confirmation_status is
  'Supplier confirmation lifecycle. Allowed values: acknowledged, changed, rejected, unverified under COLLATE "C".';
