# MISE-005MR supplierDelivery orderId ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-supplier-delivery-order-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `deliveryClientIdForOrder` normalized `orderId` with Unicode
`String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`) padding around
a valid supplier-order id would still normalize to that id, inventing a
generated `supplier_delivery:…` client-delivery identity that matched the
unpadded order before receive idempotency keys were written.

## Change

- Added `services/domain/supplierDeliveryOrderIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed `deliveryClientIdForOrder` `orderId` through
  `requireCanonicalSupplierDeliveryOrderId`.
- Preserved distinct require message `Supplier delivery requires an order id.`
  for focused inventing proofs.
- Left application `receiveSupplierOrderDelivery` restaurant / supplierOrderId /
  clientDeliveryId Unicode trim paths for open tips #748 / #760 / #765.
- Left `receivedAt` unchanged.
- Non-UUID demo tokens (e.g. `so-demo-order`) intentionally preserved; no UUID
  shape gate on this path.

## Merge note

Alone-OK relative to open stacks through #773. Does not share identity modules
with deliveries supplier-order (#760), client-delivery (#765), or restaurant
(#748) tips. Drop any assertion that `deliveryClientIdForOrder` still uses
Unicode `orderId.trim()`; this tip owns that domain object identity. Application
receive Unicode trims remain owned by their open tips until those land.

## Verification

- `tests/supplierDeliveryOrderAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
