# MISE-005YA: Setup recipe dishName a11y ASCII C

Date: 2026-11-04

## Defect

Setup recipes-step remove / recipe-ingredient / add-ingredient accessibility
labels always passed raw `recipe.dishName` through:

```ts
recipe.dishName || t("setup.fallback.recipe")
```

Empty string already fell through, but Unicode-only-space names are truthy and
bypassed the intentional localized `setup.fallback.recipe` fallback
(blank-looking a11y recipe identity). Unicode `.trim()` on NBSP/em-space-padded
names would also invent a clean a11y recipe token.

## Fix

- Soft-null via `normalizeSetupRecipeDishName` (ASCII C single-line: end trim
  only; preserve NBSP; full C0/DEL reject)
- Soft-null falls through to existing `t("setup.fallback.recipe")`
  (EN/ES/zh-Hans)
- Applied only to `setup.remove.recipe`,
  `setup.field.recipeIngredientAccessibility`, and
  `setup.addIngredientAccessibility` interpolations

## Alone-OK

Leave alone:

- TextInput `value={recipe.dishName}`
- quantity/unit a11y `ingredient.itemName` / `setup.fallback.ingredient`
  (open #1086 / MISE-005XZ)
- open #862 / MISE-005QB validate/normalize (`setupRecipeDishNameIdentity.ts`)
- open #900 / MISE-005RN setup-drafts dishName prep
- Recipes dish menu_item_name (#1080)

## Verification

- focused `tests/setupRecipeDishNameA11yAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
