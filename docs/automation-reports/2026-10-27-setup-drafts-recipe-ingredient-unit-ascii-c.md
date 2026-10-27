# MISE-005RM setup-drafts recipe ingredient unit ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-recipe-ingredient-unit-ascii-c`

## Problem

`services/domain/setupDrafts.ts` `recipeDraftsToBaselineText` Unicode-trimmed
recipe ingredient `unit` into the durable baseline string used at setup save
(`'\u2003oz\u2003'.trim() === 'oz'` → `"Tomato 12 oz"`). Matching recipe
readiness / persistence-preview / data-health gates used the same Unicode trim
for unit presence, so NBSP / em-space padding invented a ready mapping.
Unicode-only space also invented the soft-empty skip via `'\u2003'.trim() ===
''`.

This is separate from open #898 / MISE-005RL (setup-drafts itemName), open #897
/ MISE-005RK (setup-drafts quantity), open #896 / MISE-005RJ (setup.tsx recipe
quantity), open #862 / MISE-005QB (setup recipe dish names), and open #861 /
MISE-005QA (setup inventory units).

## Change

- New `services/domain/setupDraftsRecipeIngredientUnitIdentity.ts` (MISE-005RM)
- Soft empty / Unicode-only space → `""` (missing-unit skip / not ready)
- ASCII whitespace still trims clean before baseline text is built
- Unicode-padded / control → `""` (no invent into baseline or readiness)
- Wire `recipeDraftsToBaselineText`, recipe readiness, persistence preview, and
  data-health recipe counts through
  `normalizeSetupDraftsRecipeIngredientUnitText`
- Leave setup-drafts recipe ingredient itemName to open #898 / MISE-005RL
- Leave setup-drafts recipe ingredient quantity to open #897 / MISE-005RK
- Leave setup.tsx `ingredient.unit.trim()` validation alone
- Leave application `ingredient.unit.trim() || "unit"` alone
- Leave inventory `item.unit.trim()` / open #861 alone
- Leave setup-drafts `dishName` bare trim alone for a later tip

## Landing notes

Alone-OK with #898 / #897 / #896 / #895 / #894 / #893 / #892 / #891 / #890 /
#889 / #862 / #861 / #679. Keep
`setupDraftsRecipeIngredientUnitIdentity.ts` separate from
`setupDraftsRecipeIngredientItemNameIdentity.ts` (#898),
`setupDraftsRecipeIngredientQuantityIdentity.ts` (#897),
`setupInventoryUnitIdentity.ts` (#861), and sibling modules. When landing with
#898, drop this tip's assertion that setupDrafts still uses
`ingredient.itemName.trim()` / `const itemName = ingredient.itemName.trim()`
once #898 owns itemName; when landing with #897, drop this tip's assertion that
setupDrafts still uses `ingredient.quantity.trim()` /
`const quantity = ingredient.quantity.trim()` once #897 owns quantity; do not
merge the unit, itemName, and quantity modules.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 687 pass / 0 fail / 0 cancelled (tip +4 vs main ~683)
