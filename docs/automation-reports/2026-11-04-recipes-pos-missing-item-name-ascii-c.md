# MISE-005XV — Recipes POS missing-recipe badge itemName ASCII C

Date: 2026-11-04

## Defect

Settings → Recipes always passed raw `posItemsMissingRecipes` / `missingMenuItems`
entries into warning `Badge` and builder `SuggestionChip` labels. Empty or
Unicode-only-space POS menu names are non-nullish (and Unicode-only-space is
truthy), so badges rendered blank-looking menu identity with no intentional
localized none marker. Unicode `.trim()` on NBSP/em-space-padded names would
invent a clean display label.

## Fix

- Soft-null via `normalizeRecipesPosMissingItemName` (ASCII C end trim only;
  preserve NBSP; full C0/DEL reject).
- Fallback `t("recipes.warning.itemName.none")` in EN / ES / zh-Hans.
- Leave React keys, builder `onPress` write-back, active Unicode-trim equality,
  recipes.notice.linked (#1081), recipeName / confirmed (#1080),
  ingredient.itemName (#1067), inventory-item chips, and domain
  `posItemsMissingRecipes` computation alone.

## Verification

- Focused `tests/recipesPosMissingItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test` (inherited recalculationCycles cancellations only)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
