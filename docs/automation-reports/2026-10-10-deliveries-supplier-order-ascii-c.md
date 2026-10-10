# MISE-005MD deliveries supplierOrderId ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-deliveries-order-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Deliveries application `receiveSupplierOrderDelivery` normalized `supplierOrderId`
with Unicode `String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`)
padding around a valid supplier-order id would still normalize to that id,
inventing a workflow identity the operator never typed as an ASCII-bounded
token before receive writes ran.

## Change

- Added `services/domain/deliveriesSupplierOrderIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed `receiveSupplierOrderDelivery` `supplierOrderId` through
  `requireCanonicalDeliveriesSupplierOrderId` in `services/application/deliveries.ts`.
- Preserved `Missing supplier order.`
- Left restaurant workspace on Unicode trim (owned by #748 / MISE-005LR).
- Left optional `clientDeliveryId?.trim()` on Unicode trim for a later tip.
- Left sibling restaurant/object tips untouched.
- Non-UUID demo tokens (e.g. `so-demo-order`) intentionally preserved; no UUID
  shape gate on this path.

## Merge note

When landing with #748, keep both restaurant and supplier-order branches in
`deliveries.ts`. Drop any assertion that `supplierOrderId` still uses Unicode
`value.trim()`; this tip owns that object identity. #748 owns restaurant
`Missing restaurant workspace.`

## Verification

- `tests/deliveriesSupplierOrderAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
