# Delivery double-count guard (2026-08-30)

## Problem

Log Delivery (`operator_receipt`) and supplier-order **Mark delivery received**
(`supplier_delivery`) both increase on-hand inventory. Operators could log an
ad-hoc receipt for an item already on a sent order, then mark that order
received, double-counting stock.

## Solution

Deterministic conflict detection with fail-closed UI:

1. Domain helpers in `services/domain/deliveryReceiptConflict.ts`
   - Open sent-order conflicts for a selected inventory item
   - Manual/`operator_receipt` (and pending outbox) conflicts for a sent order
2. Application loaders in `services/application/deliveries.ts`
3. Log Delivery: warn + deep-link to the sent order; require two-step confirm
   before ad-hoc receipt; block submit when the conflict check fails
4. Order detail: warn + deep-link to Log Delivery; require two-step confirm
   before Mark received when ad-hoc receipts already exist

## Tests

- `tests/deliveryReceiptConflict.test.ts` — 6/6 pass
- `npm run typecheck` — pass
- `npm test` — 638 pass / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — pass

## Not in scope

- Server-side hard block of dual paths (still intentional for extras/partials)
- Locale-aware supplier send templates
- Redeploying open stacks #132–#266
