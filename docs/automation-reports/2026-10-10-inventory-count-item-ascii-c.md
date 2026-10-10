# MISE-005MN: pin inventory count-session inventoryItemId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-inventory-count-item-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins domain inventory count-session `mergeCountLineUpdates` `inventoryItemId`
to ASCII-only end trim so NBSP/em-space padding cannot invent a normalized
inventory-item identity before count-line saves match session lines.

- Adds `services/domain/inventoryCountItemIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `mergeCountLineUpdates` `inventoryItemId` through
  `requireCanonicalInventoryCountItemId`.
- Preserves `Count line is missing an inventory item.` for inventing/invalid
  tokens.
- Leaves count-line `note` on Unicode trim (operator free-text).
- Leaves application inventory.ts restaurant / menuItemId / inventoryItemId
  paths alone (owned by #744 / #763 / #767).
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

This tip only touches domain count-session inventory-item identity. When
landing near #767, keep both modules: #767 owns application recipe-baseline
`Choose an inventory item.` / `requireCanonicalInventoryItemId`; this tip owns
count-session `Count line is missing an inventory item.` /
`requireCanonicalInventoryCountItemId`. Do not merge the helpers.

## Verification

- `tests/inventoryCountItemAsciiC.test.ts`: 4/4
- `tests/inventoryCountSessions.test.ts`: 9/9 (regression)
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this count-session inventoryItemId path after merge.
- Bundle application inventoryItemId (#767), menuItemId (#763), restaurant
  (#744), or sibling object tips in the same PR.
- Rewrite count-line note trim in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
