# MISE-005RL setup-drafts recipe ingredient itemName ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-recipe-ingredient-item-name-ascii-c`

## Problem

`services/domain/setupDrafts.ts` `recipeDraftsToBaselineText` Unicode-trimmed
recipe ingredient `itemName` into the durable baseline string used at setup
save (`'\u2003Tomato\u2003'.trim() === 'Tomato'` → `"Tomato 12 oz"`). Matching
recipe readiness / persistence-preview / data-health gates used the same
Unicode trim for itemName presence, so NBSP / em-space padding invented a ready
mapping. Unicode-only space also invented the soft-empty skip via
`'\u2003'.trim() === ''`.

This is separate from open #897 / MISE-005RK (setup-drafts quantity), open #896
/ MISE-005RJ (setup.tsx recipe quantity), open #862 / MISE-005QB (setup recipe
dish names), open #861 / MISE-005QA (setup inventory units), and open #679 /
MISE-005JJ (application inventory-name key matching).

## Change

- New `services/domain/setupDraftsRecipeIngredientItemNameIdentity.ts`
  (MISE-005RL)
- Soft empty / Unicode-only space → `""` (missing-itemName skip / not ready)
- ASCII whitespace still trims clean before baseline text is built
- Unicode-padded / control → `""` (no invent into baseline or readiness)
- Wire `recipeDraftsToBaselineText`, recipe readiness, persistence preview, and
  data-health recipe counts through
  `normalizeSetupDraftsRecipeIngredientItemNameText`
- Leave setup-drafts recipe ingredient quantity to open #897 / MISE-005RK
- Leave setup.tsx `ingredient.itemName.trim()` validation alone
- Leave application `ingredient.itemName.trim()` / #679 key matching alone
- Leave setup-drafts `dishName` / `unit` bare trim alone for later tips

## Landing notes

Alone-OK with #897 / #896 / #895 / #894 / #893 / #892 / #891 / #890 / #889 /
#862 / #861 / #679. Keep
`setupDraftsRecipeIngredientItemNameIdentity.ts` separate from
`setupDraftsRecipeIngredientQuantityIdentity.ts` (#897),
`setupRecipeIngredientQuantityIdentity.ts` (#896),
`setupRecipeDishNameIdentity.ts` (#862), and sibling modules. When landing with
#897, drop this tip's assertion that setupDrafts still uses
`ingredient.quantity.trim()` / `const quantity = ingredient.quantity.trim()`
once #897 owns quantity; do not merge the itemName and quantity modules. When
landing with #896, keep setup.tsx recipe quantity ownership on #896.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
