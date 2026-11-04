# MISE-005XT — Recipes dish menu_item_name ASCII C

Date: 2026-11-04  
Branch: `cursor/mise-recipes-dish-menu-item-name-ascii-c`

## Defect

Settings → Recipes always passed raw `item.menu_item_name` into the recipeName
Text and into the confirm-complete notice:

```ts
<Text style={styles.recipeName}>{item.menu_item_name}</Text>
setNotice(t("recipes.notice.confirmed", { item: item.menu_item_name }));
```

Empty string rendered a blank-looking dish identity. A Unicode-only-space dish
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded dish name would invent a clean display / notice
label (`"\u2003Chicken Bowl\u2003".trim() === "Chicken Bowl"`).

## Fix

- `services/domain/presentationRecipesDishMenuItemNameIdentity.ts` — ASCII C
  single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/settings/recipes.tsx` — recipeName Text and
  `recipes.notice.confirmed` through `normalizeRecipesDishMenuItemName` with
  localized `recipes.row.menuItemName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/recipesDishMenuItemNameAsciiC.test.ts`

## Alone-OK

Leaves Recipes ingredient.itemName (#1067), recipes.notice.linked draft
ingredient/dish tokens, setup recipe dish names (#862), inventory
recipe-mapping menuItemName (#863), demo recipe-baseline menuItemName (#905),
recipe-authority hydrate menuItemName (#935), recipe-baseline inventory
itemName (#1035), POS missing-recipe badge labels, and React list keys on raw
`menu_item_name` alone.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test`
