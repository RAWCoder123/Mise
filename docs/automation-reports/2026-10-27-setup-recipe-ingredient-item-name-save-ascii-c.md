# MISE-005RP: pin setup recipe ingredient itemName saves to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-recipe-ingredient-item-name-save-ascii-c`

## Inventing proof

`saveRestaurantSetup` stored recipe ingredient item names via Unicode `.trim()`
before persisting them as inventory / recipe-mapping identity:

```ts
const ingredientName = ingredient.itemName.trim();
if (!ingredientName || quantityUsedPerSale <= 0) continue;
```

NBSP / em-space padding invented a clean durable ingredient name before
persistence (`'\u2003Tomato\u2003'.trim() === 'Tomato'`). Soft-empty
Unicode-only padding also collapsed into the intentional ingredient skip.

Open tips that own related surfaces do not cover this operator boundary:

- #901 / MISE-005RO — setup.tsx recipe ingredient itemName validate/normalize
- #898 / MISE-005RL — setup-drafts recipe ingredient itemName baseline tokens
- #862 / MISE-005QB — setup recipe dishName save identity
- #861 / MISE-005QA — setup inventory / recipe unit save identity
- #679 / MISE-005JJ — setup inventory-name keys

## Change

- Add `services/domain/setupRecipeIngredientItemNameSaveIdentity.ts` with
  ASCII-only end trim and fail-closed canonicalize (MISE-005RP).
- Route `ingredient.itemName` through
  `normalizeCanonicalSetupRecipeIngredientItemNameSave(...)`.
- Soft empty (ASCII or Unicode-only space) still skips the ingredient.
- Unicode-padded non-empty tokens fail closed with
  `Setup recipe ingredient item name is invalid.`
- Leave draft name, dishName, units, attachment label, restaurantId, supplier
  emptiness, setup.tsx itemName (#901), and setup-drafts itemName (#898) alone.

## Verification

- focused AsciiC: 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK relative to #901 / #898 / #862 / #861 / #679 (separate modules). When
landing with #901, drop that tip's assertion that application setup still uses
`const ingredientName = ingredient.itemName.trim();` once this tip owns the
save path; drop this tip's assertion that setup.tsx still uses bare
`ingredient.itemName.trim()` once #901 owns validate/label. When landing with
#862, drop that tip's assertion that application still uses
`ingredient.itemName.trim()` once this tip owns it; drop this tip's assertion
that `menuItemName = recipe.dishName.trim()` once #862 owns dishName. When
landing with #861, drop mutual unit Unicode-trim assertions once that tip owns
units. Do not merge `setupRecipeIngredientItemNameSaveIdentity.ts` with
`setupRecipeIngredientItemNameIdentity.ts` (#901) or
`setupDraftsRecipeIngredientItemNameIdentity.ts` (#898).
