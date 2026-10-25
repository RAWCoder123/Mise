# MISE-005QB: pin setup recipe dish names to ASCII C

Date: 2026-10-25  
Branch: `cursor/mise-setup-recipe-dish-name-ascii-c`

## Inventing proof

`saveRestaurantSetup` stored recipe dish names via Unicode `.trim()` before
persisting them as `menu_item_name`:

```ts
const menuItemName = recipe.dishName.trim();
if (!menuItemName) continue;
```

NBSP / em-space padding invented a clean durable menu item name before
persistence (`'\u2003Margherita Pizza\u2003'.trim() === 'Margherita Pizza'`).
Soft-empty Unicode-only padding also collapsed into the intentional recipe skip.

Open tips that own related surfaces do not cover this operator boundary:

- #599 / MISE-005GI — `menu_item_ingredients.menu_item_name` SQL cntrl CHECK
- #678 / MISE-005JI — inventory recipe menu-item key client fold
- #679 / MISE-005JJ — setup inventory-name keys
- #861 / MISE-005QA — setup inventory / recipe units
- #843 / MISE-005PI — setup attachment labels
- #742 / MISE-005LL — setup restaurant workspace
- #769 / MISE-005MM — setup referenceId

## Change

- Add `services/domain/setupRecipeDishNameIdentity.ts` with ASCII-only end trim
  and fail-closed canonicalize (MISE-005QB).
- Route `recipe.dishName` through
  `normalizeCanonicalSetupRecipeDishName(...)`.
- Soft empty (ASCII or Unicode-only space) still skips the recipe.
- Unicode-padded non-empty tokens fail closed with
  `Setup recipe dish name is invalid.`
- Leave draft name, ingredient itemName, units, attachment label, restaurantId,
  supplier emptiness, referenceId, and setupDrafts presentation emptiness
  alone.

## Verification

- focused AsciiC: 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK relative to #599 / #678 / #679 / #861 / #843 / #742 / #769 (separate
modules). When landing with #861, keep `setupRecipeDishNameIdentity` separate
from unit helpers and drop any mutual assertions that the other field still
Unicode-trims once that tip owns it. When landing with #679, keep this module
separate from inventory-name key helpers.
