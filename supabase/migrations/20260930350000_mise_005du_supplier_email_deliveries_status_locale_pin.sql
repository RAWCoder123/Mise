-- MISE-005DU: pin private.supplier_email_deliveries.status CHECK to COLLATE "C",
-- preserving the exact-token allowlist.
--
-- private.supplier_email_deliveries stores Gmail supplier-send delivery
-- lifecycle under a bare IN allowlist from gmail_backend_oauth_delivery:
--   status in ('sending', 'sent', 'failed', 'unknown')
-- That allowlist is exact string equality and carries no dedicated ASCII
-- shape gate under COLLATE "C". Writers mint durable ASCII tokens only:
--   'sending' | 'sent' | 'failed' | 'unknown'
--
-- status gates claim acquisition, provider acceptance, rejection, and
-- unknown outcome handling for supplier email sends. POSIX character
-- classes follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; open sibling pins through
-- #532 leave supplier_email_deliveries.status on bare IN. Open tip #423
-- pinned Gmail sender_email shape and deferred delivery status; #500
-- pinned connection status and deferred this private delivery ledger.
--
-- If LC_CTYPE drifted under a bare-IN supplier_email_deliveries.status
-- CHECK, dump/restore could accept delivery-status bytes the restored
-- C-locale path (and sibling Gmail/send gates) would refuse — or the
-- reverse — breaking supplier-send delivery continuity across restore.
--
-- Scope:
--   - Replace supplier_email_deliveries_status_check with exact-token
--     allowlist PLUS ASCII shape under COLLATE "C"
-- Does NOT rewrite Gmail OAuth/send edge writers, claim/complete RPCs,
-- supplier_email_deliveries_sent_check, sender_email (#423), connection
-- status (#500), or outreach_messages.status (#532). Timestamp after
-- MISE-005DT (#532).

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_status_check;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_status_check
  check (
    status in (
      'sending',
      'sent',
      'failed',
      'unknown'
    )
    and status collate "C" ~ '^[A-Za-z0-9._-]{1,80}$'
  );

comment on constraint supplier_email_deliveries_status_check
  on private.supplier_email_deliveries is
  'MISE-005DU: exact sending/sent/failed/unknown allowlist plus ASCII shape under COLLATE "C". Gmail supplier-email delivery lifecycle state.';

comment on column private.supplier_email_deliveries.status is
  'Supplier email delivery lifecycle. Allowed values: sending, sent, failed, unknown under COLLATE "C".';
