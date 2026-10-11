# MISE-005MX supplierReliability restaurant workspace ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-supplier-reliability-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `buildSupplierReliabilitySummary` and `buildSupplierOrderDeliveryEvidence`
normalized `restaurantId` with Unicode `String.prototype.trim()`. NBSP
(`U+00A0`) or em-space (`U+2003`) padding around a valid restaurant workspace
token would still normalize to that token, inventing an exact tenant match
against unpadded order, delivery, and delivery-item `restaurant_id` rows before
`requireTenantScope` ran.

## Change

- Added `services/domain/supplierReliabilityRestaurantIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize/require helpers.
- Routed `buildSupplierReliabilitySummary` through
  `requireCanonicalSupplierReliabilityWorkspaceId`.
- Routed `buildSupplierOrderDeliveryEvidence` through
  `requireCanonicalSupplierDeliveryEvidenceWorkspaceId`.
- Preserved distinct require messages:
  - `Supplier reliability requires a restaurant workspace.`
  - `Supplier delivery evidence requires a restaurant workspace.`
- Left `supplier_id.trim()` / `supplier_name.trim()` presentation paths alone.
- Left sibling domain restaurant workspace Unicode trim on
  `insightsSalesAnalytics` for a later tip.
- UUID-shaped and non-UUID demo tokens intentionally preserved; max length 128.

## Merge note

Alone-OK relative to open stacks through #779 and #192. Does not share identity
modules with order-automation restaurant (#779) or Insights sales analytics.
When #779 also lands, drop its assertion that domain `supplierReliability` still
Unicode-trims `input.restaurantId`. This tip does not assert that
`orderAutomation` still Unicode-trims restaurantId because #779 already owns
that path.

## Verification

- `tests/supplierReliabilityRestaurantAsciiC.test.ts`: focused inventing proofs
- `tests/supplierReliability.test.ts`: existing reliability suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
