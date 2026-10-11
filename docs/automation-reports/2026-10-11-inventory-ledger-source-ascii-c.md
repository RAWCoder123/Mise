# MISE-005NA inventory ledger source ASCII C

## Summary

Unicode `source.trim()` on inventory ledger `acceptInventoryEvent` treated
NBSP/em-space-padded source labels as present, then stored and compared the raw
padded string. That invents a parallel source identity beside the unpadded label
(Unicode trim would equal the real token; exact match would not).

## Change

- Add `services/domain/inventoryLedgerSourceIdentity.ts` with ASCII-only end
  trim and fail-closed canonicalize (MISE-005NA).
- Route domain `acceptInventoryEvent` through
  `canonicalizeInventoryLedgerSource`, preserving the existing `missing_source`
  rejection contract.
- Cap length at 80 to mirror `inventory_events.source` CHECK.
- Leave inventory ledger restaurant workspace (`restaurantId`) and object
  identities (`inventoryItemId` / `clientEventId` / `idempotencyKey`) on Unicode
  trim for open tips #782 / #771.
- Do not rewrite sibling ledger identity helpers.

## Inventing proof

`'\u00a0receiving\u00a0'.trim() === 'receiving'` while ASCII-C canonicalize
returns `null` and accept rejects with `missing_source`. On current main,
accept previously stored the padded label as a parallel source identity.

## Verification

- `npm run typecheck`
- focused `inventoryLedgerSourceAsciiC` + `inventoryLedger` tests
- `npm run security:static` / `npm run security:backend`
- `npm test`
