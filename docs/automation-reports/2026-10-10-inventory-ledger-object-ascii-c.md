# MISE-005MO: pin inventory ledger object identities to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-inventory-ledger-object-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins domain inventory ledger `acceptInventoryEvent` object identities
(`inventoryItemId`, `clientEventId`, `idempotencyKey`) to ASCII-only end trim
so NBSP/em-space padding cannot invent normalized ledger identities before
acceptance, dedupe, or projection scoping.

- Adds `services/domain/inventoryLedgerObjectIdentity.ts` with fail-closed
  canonicalize helpers.
- Routes ledger object IDs through `canonicalizeInventoryLedgerObjectId` before
  acceptance.
- Preserves `missing_scope` / `missing_idempotency` rejection reasons.
- Leaves `restaurantId.trim()` and `source.trim()` on Unicode trim.
- Leaves application inventoryItemId (#767) and count-session inventoryItemId
  (#770) helpers alone.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Inventing proof

Unicode `.trim()` strips NBSP/em-space around `chicken`, `device-event-1`, and
`receiving:delivery-1:chicken`, inventing exact matches against the unpadded
tokens. ASCII-only end trim keeps the padding, and canonicalize returns null so
acceptance rejects with the existing reason codes.

## Merge note

Land alone-OK relative to #767 / #770 (separate modules and call sites). Do not
merge helpers or rewrite restaurant/source trim in this tip.

## Verification

- `tests/inventoryLedgerObjectAsciiC.test.ts`: focused run
- `tests/inventoryLedger.test.ts`: regression
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`

## Do not

- Re-tip these ledger object paths after merge.
- Bundle restaurant/source, application inventoryItemId (#767), count-session
  inventoryItemId (#770), or sibling domain object tips in the same PR.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
