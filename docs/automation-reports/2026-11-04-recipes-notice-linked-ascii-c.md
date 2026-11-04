# MISE-005XU — recipes.notice.linked ingredient + dish ASCII C

Date: 2026-11-04  
Branch: `cursor/mise-recipes-notice-linked-ascii-c`

## Defect

Settings → Recipes always passed raw inventory `item_name` and the
Unicode-trimmed draft dish name into the add-link success notice:

```ts
const menuItemName = newMenuItemName.trim();
setNotice(t("recipes.notice.linked", {
  ingredient: selectedInventoryItem.item_name,
  dish: menuItemName
}));
```

Empty / Unicode-only-space inventory names rendered a blank-looking ingredient
token. Unicode `.trim()` on a padded draft dish name invented a clean dish
label for the notice (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`).
The same inventing path applies if ingredient names were Unicode-trimmed before
interpolation.

## Fix

- `services/domain/presentationRecipesNoticeLinkedIngredientIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `services/domain/presentationRecipesNoticeLinkedDishIdentity.ts` — same for
  the raw `newMenuItemName` draft (not the already-trimmed API gate value)
- `app/settings/recipes.tsx` — `recipes.notice.linked` through both normalizers
  with localized `recipes.notice.linked.ingredient.none` /
  `recipes.notice.linked.dish.none` fallbacks
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/recipesNoticeLinkedAsciiC.test.ts`

## Alone-OK

Leaves Recipes ingredient.itemName row chrome (#1067), recipeName Text /
recipes.notice.confirmed dish (#1080), setup recipe dish names (#862),
inventory recipe-mapping menuItemName (#863), demo recipe-baseline menuItemName
(#905), recipe-authority hydrate menuItemName (#935), recipe-baseline inventory
itemName (#1035), POS missing-recipe badge labels, React list keys on raw
`menu_item_name`, and the `addRecipeBaselineIngredient` write path that still
uses `newMenuItemName.trim()` for validation alone.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
