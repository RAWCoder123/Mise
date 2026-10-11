# MISE-005MW orderAutomation restaurant workspace ASCII C

Date: 2026-10-11  
Branch: `cursor/mise-order-automation-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Domain `assessOrderAutomation` normalized `restaurantId` with Unicode
`String.prototype.trim()`. NBSP (`U+00A0`) or em-space (`U+2003`) padding around
a valid restaurant workspace token would still normalize to that token, inventing
an exact tenant match against unpadded candidate, inventory, and recommendation
history `restaurant_id` rows before automation blockers were evaluated.

Open tip #773 pinned `supplierId` on the same assessment and intentionally left
`restaurantId.trim()` and `supplierName.trim()` alone for a later tip.

## Change

- Added `services/domain/orderAutomationRestaurantIdentity.ts` with ASCII-only
  end trim and fail-closed canonicalize/require helpers.
- Routed `assessOrderAutomation` through
  `requireCanonicalOrderAutomationWorkspaceId`.
- Preserved distinct require message `Order automation requires a restaurant.`
  for focused inventing proofs (separate from #773
  `Order automation requires a supplier id.`).
- Left `supplierId.trim()` and `supplierName.trim()` for open tip #773 and
  presentation-only supplier names.
- Left sibling domain restaurant workspace Unicode trims on
  `supplierReliability` and `insightsSalesAnalytics` for later tips.
- UUID-shaped and non-UUID demo tokens intentionally preserved; max length 128.

## Merge note

Alone-OK relative to open stacks through #778 and #192. Does not share identity
modules with order-automation supplier (#773) or sibling domain restaurant tips.
When #773 also lands, drop assertions that domain `orderAutomation` still
Unicode-trims `input.supplierId` (this tip currently asserts that main still
does). When landing #773 after this tip, #773 must drop its assertion that
`restaurantId` still Unicode-trims.

## Verification

- `tests/orderAutomationRestaurantAsciiC.test.ts`: focused inventing proofs
- `tests/orderAutomation.test.ts`: existing automation gate suite
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test` (expect pre-existing recalculationCycles cancelledByParent only)
