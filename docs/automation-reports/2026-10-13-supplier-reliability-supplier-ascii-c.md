# MISE-005OQ supplierReliability supplier_id ASCII C

Date: 2026-10-13  
Branch: `cursor/mise-supplier-reliability-supplier-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildSupplierReliabilitySummary` grouped deliveries with
`order.supplier_id.trim()` as the Map key. NBSP (`U+00A0`) or em-space
(`U+2003`) padding around a valid supplier token would still normalize to that
token, inventing a clean grouping key and merging padded supplier identities
with unpadded ones
(`'\u2003uuid\u2003'.trim() === 'uuid'`).

## Change

- Added `services/domain/supplierReliabilitySupplierIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed reliability Map-key grouping through
  `canonicalizeSupplierReliabilitySupplierId`; null continues the existing
  empty-key skip so Unicode-padded supplier ids never invent a clean key.
- Accumulator `supplierId` now stores the canonical key (ASCII-trimmed), not
  the raw padded token.
- Preserved require message `Supplier reliability requires a supplier id.`
- Left `input.restaurantId.trim()` alone (open tip #780 / MISE-005MX).
- Left `order.supplier_name.trim()` presentation prep alone.
- Left open order-automation supplier tip #773 alone.
- UUID-shaped and non-UUID demo tokens intentionally preserved; max length 128.

## Merge note

Alone-OK relative to open stacks through #824 and #192. Does not share identity
modules with supplier-reliability restaurant (#780) or order-automation
supplier (#773). When #780 also lands, drop its assertion that domain
`supplierReliability` still Unicode-trims `order.supplier_id`. When this tip
lands after #780, drop this tip's assertion that `input.restaurantId.trim()`
still appears if #780 already rewrote that path.

## Verification

- `tests/supplierReliabilitySupplierAsciiC.test.ts`: focused inventing proofs
- `tests/supplierReliability.test.ts`: existing reliability suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
