# MISE-005XG Recipes ingredient.itemName ASCII C (2026-11-03)

## Defect

Recipes Settings always passed raw `ingredient.itemName` into the ingredient
name Text and a11y interpolations. Empty / Unicode-only-space names are
non-nullish and truthy, so they rendered blank-looking ingredient identity
with no intentional localized none marker. Unicode `.trim()` on padded names
would invent a clean ingredient label.

## Fix

- `presentationRecipesIngredientItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeRecipesIngredientItemName` before ingredient name
  Text and quantity/save/read-only a11y interpolations
- Localized fallback `recipes.row.itemName.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves Inventory hub item.item_name (#1056), Inventory detail item_name
(#1017), RecommendationDecisionRow item_name (#1055), Inventory count
line.item_name (#1058), Orders hub notice item_name (#1057), Daily Report
waste.topItem itemName (#1064), Log Delivery history entry.itemName (#1062),
Scan Item row item.item_name (#1061), SupplierDraftCard line.itemName (#972),
recipe menu_item_name / POS missing-recipe badges, setup draft
ingredient.itemName validation trim, and React list keys alone.

## Verification

- focused `tests/recipesIngredientItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
