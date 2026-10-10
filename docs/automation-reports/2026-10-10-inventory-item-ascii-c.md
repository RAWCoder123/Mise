# MISE-005MK: pin inventory inventoryItemId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-inventory-item-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins inventory application `addRecipeBaselineIngredient` `inventoryItemId` to
ASCII-only end trim so NBSP/em-space padding cannot invent a normalized
inventory item identity before recipe-baseline mapping writes.

- Adds `services/domain/inventoryItemIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `addRecipeBaselineIngredient` `inventoryItemId` through
  `requireCanonicalInventoryItemId`.
- Preserves `Choose an inventory item.` for the inventory-item half.
- Leaves restaurant workspace on Unicode trim (owned by #744 / MISE-005LN).
- Leaves `confirmRecipeBaselineComplete` `menuItemId` on Unicode trim
  (owned by #763 / MISE-005MG).
- Leaves recipe-mapping `menuItemName` / `unit` trim surfaces alone.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #744 and/or #763, keep restaurant, menuItemId, and
inventoryItemId branches in `inventory.ts`. Drop #763’s assertion that
`input.inventoryItemId.trim()` still Unicode-trims on add-recipe-baseline;
this tip owns that object identity. #744 owns restaurant
`Missing restaurant workspace.` / `requireCanonicalInventoryWorkspaceId`.
#763 owns menu-item `Missing menu item.` / `requireCanonicalInventoryMenuItemId`.

## Verification

- `tests/inventoryItemAsciiC.test.ts`: 4/4
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 687 pass / 0 fail

## Do not

- Re-tip this inventory inventoryItemId object path after merge.
- Bundle restaurant (#744), menuItemId (#763), or sibling object tips in the
  same PR.
- Rewrite restaurant `restaurantId.trim()` / workspace helpers in this tip.
- Rewrite menuItemId confirm helpers in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
