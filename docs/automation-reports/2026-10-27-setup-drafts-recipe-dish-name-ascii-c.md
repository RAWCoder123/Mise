# MISE-005RN setup-drafts recipe dishName ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-recipe-dish-name-ascii-c`

## Problem

`services/domain/setupDrafts.ts` `recipeDraftsToBaselineText` Unicode-trimmed
recipe `dishName` into the durable baseline string used at setup save
(`'\u2003Margherita\u2003'.trim() === 'Margherita'` →
`"Margherita: Tomato 12 oz"`). Matching recipe readiness / persistence-preview /
data-health gates used the same Unicode trim for dishName presence, so NBSP /
em-space padding invented a ready mapping. Unicode-only space also invented the
soft-empty skip via `'\u2003'.trim() === ''`.

This is separate from open #862 / MISE-005QB (application setup recipe dishName
save path), open #899 / MISE-005RM (setup-drafts ingredient unit), open #898 /
MISE-005RL (setup-drafts itemName), and open #897 / MISE-005RK (setup-drafts
quantity).

## Change

- New `services/domain/setupDraftsRecipeDishNameIdentity.ts` (MISE-005RN)
- Soft empty / Unicode-only space → `""` (missing-dish skip / not ready)
- ASCII whitespace still trims clean before baseline text is built
- Unicode-padded / control → `""` (no invent into baseline or readiness)
- Wire `recipeDraftsToBaselineText`, recipe readiness, persistence preview, and
  data-health recipe counts through `normalizeSetupDraftsRecipeDishNameText`
- Leave application setup recipe dishName to open #862 / MISE-005QB
  (`setupRecipeDishNameIdentity.ts`)
- Leave setup-drafts recipe ingredient itemName to open #898 / MISE-005RL
- Leave setup-drafts recipe ingredient quantity to open #897 / MISE-005RK
- Leave setup-drafts recipe ingredient unit to open #899 / MISE-005RM
- Leave setup.tsx dishName / ingredient validation alone

## Landing notes

Alone-OK with #899 / #898 / #897 / #896 / #895 / #894 / #893 / #892 / #891 /
#890 / #889 / #862 / #861 / #679. Keep
`setupDraftsRecipeDishNameIdentity.ts` separate from
`setupRecipeDishNameIdentity.ts` (#862),
`setupDraftsRecipeIngredientUnitIdentity.ts` (#899),
`setupDraftsRecipeIngredientItemNameIdentity.ts` (#898), and
`setupDraftsRecipeIngredientQuantityIdentity.ts` (#897). When landing with
#899/#898/#897, do not merge dishName with ingredient modules; drop those tips'
assertions that setupDrafts still uses `const dishName = recipe.dishName.trim()`
/ `recipe.dishName.trim()` once this tip owns dishName. This tip asserts
setupDrafts still uses bare ingredient `itemName` / `quantity` / `unit`
`.trim()` until those tips own them — drop those assertions once they land.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (tip +4 vs main
  ~683; cancelled are inherited `recalculationCycles` `withTimeout` hangs, not
  tip regressions)
