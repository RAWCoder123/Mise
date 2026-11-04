# MISE-005XW — Recipes builder inventory SuggestionChip item.item_name ASCII C

Date: 2026-11-04

## Defect

Settings → Recipes builder always passed raw `item.item_name` into inventory
`SuggestionChip` labels. Empty or Unicode-only-space inventory names are
non-nullish (and Unicode-only-space is truthy), so chips rendered blank-looking
inventory identity with no intentional localized none marker. Unicode `.trim()`
on NBSP/em-space-padded names would invent a clean display label.

## Fix

- Soft-null via `normalizeRecipesBuilderInventoryItemName` (ASCII end trim only;
  preserve NBSP; full C0/DEL reject).
- Fallback `t("recipes.builder.inventoryItemName.none")` in EN / ES / zh-Hans.
- Leave React keys (`item.id`), builder `onPress` write-back, selectedInventoryItem
  Unicode-trim equality, POS missing-recipe badge itemName (#1082),
  recipes.notice.linked (#1081), recipeName / confirmed (#1080),
  ingredient.itemName (#1067), Inventory hub item.item_name (#1056), and
  recipe-baseline inventory itemName (#1035) alone.

## Verification

- Focused `tests/recipesBuilderInventoryItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (inherited recalculationCycles cancellations only)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
