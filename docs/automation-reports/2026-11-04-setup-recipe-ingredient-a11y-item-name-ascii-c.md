# MISE-005XZ Setup recipe ingredient.itemName a11y ASCII C

Date: 2026-11-04

## Defect

Setup recipes-step quantity and unit accessibility labels always passed raw
`ingredient.itemName` through `ingredient.itemName || t("setup.fallback.ingredient")`.
Empty string already fell through, but Unicode-only-space names are truthy, so
they bypassed the intentional localized fallback and announced blank-looking
ingredient identity. Unicode `.trim()` on NBSP/em-space-padded names would also
invent a clean a11y ingredient token.

## Fix

- Soft-null via `normalizeSetupRecipeIngredientItemName` (ASCII C single-line:
  end trim only; preserve NBSP; full C0/DEL reject).
- Soft-null falls through to existing `t("setup.fallback.ingredient")` (EN/ES/zh-Hans).
- Applied only to quantityAccessibility and unitAccessibility interpolations.

## Alone-OK

Leave alone:

- TextInput `value={ingredient.itemName}`
- `recipe.dishName` a11y / `setup.fallback.recipe`
- Recipes ingredient.itemName (#1067)
- Recipes builder inventory SuggestionChip item.item_name (#1083)
- Inventory hub item.item_name (#1056)
- setup draft validation `ingredient.itemName.trim()` emptiness gates
- open #901 / MISE-005RO setup recipe ingredient itemName validate/normalize
  (`setupRecipeIngredientItemNameIdentity.ts`) — different module and call
  sites; do not merge identity helpers

## Verification

- focused `tests/setupRecipeIngredientItemNameA11yAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
