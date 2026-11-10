# MISE-005ABQ Settings Recipes a11y ingredient.itemName ASCII C (2026-11-10)

## Defect

Settings Recipes quantity / save / readOnly accessibility labels always
interpolated raw `ingredient.itemName` into a11y tokens. Empty /
Unicode-only-space names rendered blank-looking ingredient identity with no
intentional localized fallback. Unicode `.trim()` on padded names would invent
a clean ingredient label.

## Fix

- `presentationRecipesIngredientAccessibilityItemNameIdentity.ts` — ASCII C
  single-line prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeRecipesIngredientAccessibilityItemName` before
  quantityAccessibility / readOnlyAccessibility / saveAccessibility
  interpolations
- Localized fallback `recipes.row.accessibility.ingredient.none`
  (EN/ES/zh-Hans)

## Alone-OK

Leaves Settings Recipes ingredient name Text display (#1067 / MISE-005XG),
Settings Recipes ingredient.unit (#1220 / MISE-005ABI), Setup recipe
ingredient.itemName a11y (#1086 / MISE-005XZ), Recipes POS missing-recipe
badge itemName (#1082), Recipes dish menu_item_name (#1080), and Recipes
builder inventory SuggestionChip (#1083) alone. Distinct module from #1067's
display identity helpers so this a11y-only tip can land independently of the
display tip that also touches a11y.

## Verification

- focused `tests/recipesIngredientAccessibilityItemNameAsciiC.test.ts`
  (5/5; 54 assertion call sites from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test` (688 total / 688 pass / 0 fail / 0 cancelled)
