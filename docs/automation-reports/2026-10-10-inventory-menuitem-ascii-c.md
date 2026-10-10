# MISE-005MG: pin inventory menuItemId to ASCII C

Date: 2026-10-10  
Branch: `cursor/mise-inventory-menuitem-ascii-c`  
Base: `origin/main` @ `78da737`

## Change

Pins inventory application `confirmRecipeBaselineComplete` `menuItemId` to
ASCII-only end trim so NBSP/em-space padding cannot invent a normalized menu
item identity before recipe-baseline confirmation writes.

- Adds `services/domain/inventoryMenuItemIdentity.ts` with fail-closed
  canonicalize/require helpers.
- Routes `confirmRecipeBaselineComplete` `menuItemId` through
  `requireCanonicalInventoryMenuItemId`.
- Preserves `Missing menu item.` for the menu-item half.
- Leaves restaurant workspace on Unicode trim (owned by #744 / MISE-005LN).
- Leaves recipe-mapping `menuItemName` / `inventoryItemId` trim surfaces alone.
- Non-UUID demo tokens intentionally preserved (no UUID shape gate).

## Merge note

When landing with #744, keep both restaurant and menuItemId branches in
`inventory.ts`. Drop any assertion that `menuItemId.trim()` still Unicode-
trims on confirm; this tip owns that object identity. #744 owns restaurant
`Missing restaurant workspace.` / `requireCanonicalInventoryWorkspaceId`.

## Verification

- `tests/inventoryMenuItemAsciiC.test.ts`: 4/4
- `npm run typecheck`: pass
- `npm run security:static` / `security:backend`: pass
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (pre-existing recalculationCycles)

## Do not

- Re-tip this inventory menuItemId object path after merge.
- Bundle restaurant (#744) or sibling object tips in the same PR.
- Rewrite restaurant `restaurantId.trim()` / workspace helpers in this tip.
- Add UUID shape requirement on this object path (demo may use non-UUID tokens).
- Tip POS mapping/menu item (#758) — that is a separate requireWorkflowId path.
