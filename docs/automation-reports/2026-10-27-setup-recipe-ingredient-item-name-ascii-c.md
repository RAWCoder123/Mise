# MISE-005RO setup recipe ingredient itemName ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-recipe-ingredient-item-name-ascii-c`

## Problem

`app/(auth)/setup.tsx` fed recipe ingredient `itemName` into
`ingredient.itemName.trim()` emptiness / label gates and into
`normalizeRecipeDraftNumbers` → `saveRestaurantSetup` /
`recipeDraftsToBaselineText`. Unicode trim invents a clean ingredient name
(`'\u2003Tomato\u2003'.trim() === 'Tomato'`). Unicode-only space also invents
the required-empty branch via `'\u2003'.trim() === ''`.

## Change

- New `services/domain/setupRecipeIngredientItemNameIdentity.ts` (MISE-005RO)
- Soft empty / Unicode-only space → `empty` (required itemName; blank normalize)
- ASCII whitespace still trims clean before labels / normalize
- Unicode-padded / control → `invalid` (`ingredientFields`; no invent)
- Wire setup recipe validate + normalize through
  `prepareSetupRecipeIngredientItemNameText`
- Leave started-ingredient detection on bare `ingredient.itemName.trim()`
- Leave setup recipe ingredient quantity to open #896 / MISE-005RJ
- Leave setup recipe ingredient unit on bare `.trim()`
- Leave setup-drafts recipe ingredient itemName to open #898 / MISE-005RL
- Leave application `ingredient.itemName.trim()` lookup alone

## Landing notes

Alone-OK with #900 / #899 / #898 / #897 / #896 / #895 / #894 / #862 / #861.
Keep `setupRecipeIngredientItemNameIdentity.ts` separate from
`setupDraftsRecipeIngredientItemNameIdentity.ts` (#898),
`setupRecipeIngredientQuantityIdentity.ts` (#896), and
`setupRecipeDishNameIdentity.ts` (#862). When landing with #898, drop that
tip's assertion that setup.tsx still uses bare `ingredient.itemName.trim()`
for validate/label once this tip owns those paths (started-ingredient
detection may still match). When landing with #896, drop this tip's
assertion that setup still uses bare
`isBoundedSetupNumber(ingredient.quantity, …)` /
`normalizeDraftNumber(ingredient.quantity, …)` once #896 owns quantity; drop
#896's assertion that setup still uses
`!ingredient.itemName.trim()` in the fields gate once this tip owns itemName.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
