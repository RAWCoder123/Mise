# Supplier-order sent_by evidence INSERT tip (2026-11-27)

## Gap

`supplier_orders.sent_by_user_id` is nullable so drafts can omit the sender
until a later send/complete UPDATE. The existing
`supplier_orders_email_delivery_check` only requires `sent_by_user_id` when
`email_provider` is set. Direct / SECURITY DEFINER inserts can still mint
`status = 'sent'` or `status = 'completed'` with `email_provider` null and
`sent_by_user_id` null, so Activity / audit analysis cannot pin the send claim
to an operator. Client and service_role DML are already revoked.

## Change

- Domain: `validateSupplierOrderSentByEvidence` → `missing_sent_by_user_id`
- Additive BEFORE INSERT tip only (no NOT NULL / status-implies-actor CHECK)
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to tip stacks #1263–#1317, supplier-order locale / cntrl pins, and
purchase-order submitted_at (#1315). The only existing fixture that INSERTs
`status = 'sent'` already stamps `sent_by_user_id`
(`supplier_send_integrity.test.sql` legacy sent row). Draft fixtures and
mark-sent UPDATEs stay untouched.

## Verification

Recorded in the PR body after local runs on this branch.
