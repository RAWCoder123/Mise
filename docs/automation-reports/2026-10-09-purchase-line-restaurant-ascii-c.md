# MISE-005KY purchase-line restaurant workspace ASCII C

Date: 2026-10-09  
Branch: `cursor/mise-purchase-line-restaurant-ascii-c`  
Base: `origin/main` @ `78da737`

## Problem

Application-layer purchase-line entry points (`ingestPurchaseLines`,
`fetchPurchaseLineHistory`, `correctPurchaseLine`,
`fetchPurchaseLineNetByItem`) used Unicode `.trim()` on `restaurantId`.
NBSP / em-space padding around a demo or hosted workspace token invents a
canonical restaurant identity before the ledger repository is reached.

## Change

- Added `services/domain/purchaseLineRestaurantIdentity.ts` with ASCII-only
  end trim, fail-closed canonicalize, and
  `requireCanonicalPurchaseLineRestaurantId`.
- Routed `services/application/purchaseLines.ts` `requireRestaurantId` through
  that helper while preserving `Missing restaurant workspace.`
- Preserved non-UUID demo workspace tokens (`restaurant_a`).
- Left `sourceDocumentReference` / purchase-line id trimming and open unit /
  currency tips (#668 / #666 / #446) untouched.

## Verification

- Focused: `tests/purchaseLineRestaurantAsciiC.test.ts` — 4/4
- Related: `tests/purchaseLines.test.ts` + `tests/demoPurchaseLineLedger.test.ts` — pass
- `npm run typecheck` — pass
- `npm test` — 687 total / 680 pass / 0 fail / 7 cancelled
- `npm run security:static` — pass
- `npm run security:backend` — pass

## Merge notes

Alone-OK relative to #727 (supplier-recipient restaurant path; separate helper
file) and purchase-line unit/currency tips. Do not re-tip this restaurant_id
path after land.
