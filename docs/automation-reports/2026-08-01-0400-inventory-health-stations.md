# Inventory Health multi-location breakdown (2026-08-01)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-f645` from tip `cursor/mise-product-inspection-38f8`.
- Restaurant-wide `fetchInventoryLocationBalances(restaurantId)` (item id optional) for demo + hosted repositories.
- Presentation builder `buildInventoryLocationHealthBreakdown` maps projected item status onto stations with positive quantity.
- Inventory tab surfaces a compact “By station” breakdown under Inventory Health when more than one storage location exists.
- Locale strings added for en / es / zh-Hans.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes` (when environment allows)

## Remaining

- Docker + hosted `verify:private-beta-security` re-proof (schema dump refresh still blocked without Docker).
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
