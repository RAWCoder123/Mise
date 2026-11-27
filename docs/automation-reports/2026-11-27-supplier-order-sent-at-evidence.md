# Supplier-order sent_at evidence INSERT tip (2026-11-27)

## Gap

`supplier_orders.sent_at` is nullable so drafts can omit the send timestamp
until a later send/complete UPDATE. The existing
`supplier_orders_email_delivery_check` only requires `sent_at` when
`email_provider` is set. Direct / SECURITY DEFINER inserts can still mint
`status = 'sent'` or `status = 'completed'` with `email_provider` null and
`sent_at` null, so Activity / audit analysis cannot place the send claim in
time. Client and service_role DML are already revoked.

## Change

- Domain: `validateSupplierOrderSentAtEvidence` → `missing_sent_at`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-timestamp CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1318 (including sibling sent_by #1318),
supplier-order locale / cntrl pins, and purchase-order submitted_at (#1315).
The only existing fixture that INSERTs `status = 'sent'` already stamps
`sent_at` (`supplier_send_integrity.test.sql` legacy sent row). Draft
fixtures and mark-sent UPDATEs stay untouched.

## Verification

Recorded in the PR body after local runs on this branch.
