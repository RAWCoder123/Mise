# Supplier delivery canonical receipt quantity (rebase 2026-11-11)

## Baseline

- `origin/main` @ `78da7376` (MISE-005A)
- Supersedes open draft **#392** (`cursor/mise-supplier-delivery-canonical-receipt`)
- Distinct from receive discrepancy checklist **#670** (operator line adjustments)
  and durable order-line receive stack **#1108/#1109/#1111**

## Problem (still present on main)

Supplier-order receive lines carry purchase-unit quantities while labeling
`canonicalUnit` as the verified ledger unit. Hosted `record_supplier_delivery`
passed purchase-unit amounts into `record_inventory_event`. Projection divides
by `canonical_quantity_per_unit`, so a 24 lb receive on a lbs→g item added
~0.05 lb of on-hand. Demo masked this by mutating native quantity without a
ledger row.

## Fix

Unchanged from #392, rebased cleanly onto current main (MISE-004C + MISE-005A):

- `purchaseUnitsToCanonicalQuantity` domain helper
- Additive migration `20260904090000_supplier_delivery_canonical_receipt_quantity.sql`
  (after MISE-004C `20260903120000`; no timestamp advance required)
- Demo receive writes converted ledger receipts when units are verified

## Verification

- `npm run typecheck` — passed
- focused `tests/supplierDeliveryCanonical.test.ts` — 5/5 pass; **30** assertion call sites counted from source
- `npm test` — 688 total / 681 pass / 0 fail / 7 cancelled (inherited)
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed

## Classification

Controlled pilot-ready data-integrity tip. Not App Store submission-ready.
