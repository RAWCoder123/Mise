# MISE-005MH: pin purchaseLines lineId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-purchase-lines-lineid-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins purchase-lines application `correctPurchaseLine` `lineId` to ASCII-only
end trim so NBSP/em-space padding cannot invent a normalized purchase-line
identity before ledger correction writes.

- Adds `services/domain/purchaseLinesObjectIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `correctPurchaseLine` `lineId` through
  `requireCanonicalPurchaseLinesLineId`.
- Preserves `Missing purchase line.` for the line-id half.
- Leaves restaurant workspace on Unicode trim (owned by #728 / MISE-005KY).
- Leaves `sourceDocumentReference.trim()` and `normalizePurchaseLineInput`
  field trim surfaces alone.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #728, keep both restaurant and lineId branches in
`purchaseLines.ts`. Drop any assertion that `lineId.trim()` still Unicode-
trims on correct; this tip owns that object identity. #728 owns restaurant
`Missing restaurant workspace.` / `requireCanonicalPurchaseLineRestaurantId`.

## Verification

- `tests/purchaseLinesObjectAsciiC.test.ts`: 4/4
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this purchaseLines lineId object path after merge.
- Bundle restaurant (#728) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` / workspace helpers in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
- Tip deliveries `clientDeliveryId` or floorNotes `taskId` — separate paths.
