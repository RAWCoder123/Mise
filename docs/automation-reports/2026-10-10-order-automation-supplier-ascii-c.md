# MISE-005MQ orderAutomation supplierId ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-order-automation-supplier-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `assessOrderAutomation` normalized `supplierId` with Unicode
`String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`) padding around
a valid supplier id would still normalize to that id, inventing a supplier
authority match against unpadded `candidate.supplier_id` / inventory
`supplier_id` values before automation blockers were evaluated.

## Change

- Added `services/domain/orderAutomationSupplierIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize/require helpers.
- Routed `assessOrderAutomation` `supplierId` through
  `canonicalizeOrderAutomationSupplierId`, mapping null to `""` so the existing
  `supplier_mismatch` blocker path remains the assessment contract.
- Preserved distinct require message `Order automation requires a supplier id.`
  for focused inventing proofs.
- Left `restaurantId.trim()` and `supplierName.trim()` on Unicode trim.
- Left sibling restaurant/object/supplier-authority tips untouched.
- Non-UUID demo tokens intentionally preserved; no UUID shape gate on this path.

## Merge note

Alone-OK relative to open stacks through #772. Does not share identity modules
with deliveries supplier-order (#760), Mise-actions object/domain tips
(#761/#772), or durable supplier-authority helpers. Drop any assertion that
`input.supplierId` still uses Unicode `value.trim()`; this tip owns that object
identity. Restaurant workspace and supplier presentation name remain Unicode
trim on this surface.

## Verification

- `tests/orderAutomationSupplierAsciiC.test.ts`: focused inventing proofs
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
