# Purchase order submitted_at evidence INSERT tip (2026-11-27)

## Gap

`public.purchase_orders.submitted_at` is nullable so draft and cancelled rows
legitimately leave it null. Direct / `service_role` inserts can still mint
`status = 'submitted'` or `status = 'received'` with `submitted_at` null —
terminal purchase orders Activity / audit analysis cannot place in time.
Client DML is revoked; service_role / direct INSERT paths still reach the
table. Fixtures and demo paths INSERT draft-only (or stamp `submitted_at`
when submitting).

## Change

- Domain: `validatePurchaseOrderSubmittedAtEvidence` → `missing_submitted_at`
- Additive BEFORE INSERT tip only (`private.enforce_purchase_order_submitted_at_evidence`)
- No NOT NULL / status-implies-timestamp CHECK
- Preserves draft / cancelled inserts and submit UPDATEs
- Does not rewrite any purchase writer
- pgTAP plan = 9 (derived from assertion call sites)

## Alone-OK

Orthogonal to purchase-orders locale / supplier-name pins, inventory
count-session `submitted_at` CHECKs, and tip stacks #1263–#1314.

## Verification

- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm run design:static`: passed
- focused `tests/purchaseOrderSubmittedAtEvidence.test.ts`: 4/4 passed
- `npm test`: 687 / 680 pass / 0 fail / 7 cancelled
- Docker unavailable for `npm run supabase:test`
