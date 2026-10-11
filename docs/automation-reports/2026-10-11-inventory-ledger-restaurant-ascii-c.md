# MISE-005MZ inventory ledger restaurant ASCII C

## Summary

Unicode `restaurantId.trim()` on inventory ledger `acceptInventoryEvent` treated
NBSP/em-space-padded workspace tokens as present, then stored and compared the
raw padded string. That invents a parallel tenant identity beside the unpadded
workspace (Unicode trim would equal the real token; exact match would not).

## Change

- Add `services/domain/inventoryLedgerRestaurantIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize (MISE-005MZ).
- Route domain `acceptInventoryEvent` through
  `canonicalizeInventoryLedgerRestaurantId`, preserving the existing
  `missing_scope` rejection contract.
- Preserve non-UUID demo workspace tokens (`restaurant-a`).
- Leave inventory ledger object identities (`inventoryItemId` /
  `clientEventId` / `idempotencyKey`) and `source` on Unicode trim for open tip
  #771 / a later source tip.
- Leave inventory application restaurant tip #744 untouched.

## Inventing proof

`'\u00a0restaurant-a\u00a0'.trim() === 'restaurant-a'` while ASCII-C canonicalize
returns `null` and accept rejects with `missing_scope`.

## Verification

- `npm run typecheck`
- focused `inventoryLedgerRestaurantAsciiC` + `inventoryLedger` tests
- `npm run security:static` / `npm run security:backend`
- `npm test`
