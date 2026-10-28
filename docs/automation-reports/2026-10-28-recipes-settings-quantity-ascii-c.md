# MISE-005SF Recipes-settings quantity ASCII C

Date: 2026-10-28

## Gap

`app/settings/recipes.tsx` fed ingredient / new-link quantity drafts into
locale `parseNumber` (`parseLocalizedNumber` → Unicode `input.trim()`)
before `requireRecipeBaselineQuantity` and durable baseline writes:

- `'\u200312\u2003'.trim() === '12'` invented a clean quantity-used-per-sale
- `'\u2003'.trim() === ''` invented the empty / quantity-error branch

## Change

- New `services/domain/recipesSettingsQuantityIdentity.ts` (MISE-005SF)
- Soft empty / Unicode-only space → `empty` (same quantity-error path)
- ASCII whitespace still trims clean before `parseNumber`
- Unicode-padded / control → `invalid` (quantity-error path)
- Wire Settings Recipes save / add / dirty-parse through
  `prepareRecipesSettingsQuantityText`
- Leave recipes-settings **name** identity to open #689 / MISE-005JT
- Leave setup / setup-drafts recipe ingredient quantities and Orders /
  inventory / Log Delivery quantity tips alone

## Verification

- focused AsciiC tests
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend` when available
- `npm test`
