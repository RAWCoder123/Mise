# MISE-005RK setup-drafts recipe ingredient quantity ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-recipe-ingredient-quantity-ascii-c`

## Problem

`services/domain/setupDrafts.ts` `recipeDraftsToBaselineText` Unicode-trimmed
recipe ingredient `quantity` into the durable baseline string used at setup
save (`'\u200312\u2003'.trim() === '12'` → `"Tomato 12 oz"`). Matching recipe
readiness / persistence-preview / data-health gates used the same Unicode trim
for quantity presence, so NBSP / em-space padding invented a ready mapping.
Unicode-only space also invented the soft-empty skip via
`'\u2003'.trim() === ''`.

This is separate from open #896 / MISE-005RJ, which pins the setup.tsx
validate/normalize locale `parseNumber` path for the same field.

## Change

- New `services/domain/setupDraftsRecipeIngredientQuantityIdentity.ts`
  (MISE-005RK)
- Soft empty / Unicode-only space → `""` (missing-quantity skip / not ready)
- ASCII whitespace still trims clean before baseline text is built
- Unicode-padded / control → `""` (no invent into baseline or readiness)
- Wire `recipeDraftsToBaselineText`, recipe readiness, persistence preview, and
  data-health recipe counts through
  `normalizeSetupDraftsRecipeIngredientQuantityText`
- Leave setup.tsx locale parseNumber recipe quantity path to open #896 /
  MISE-005RJ
- Leave setup inventory on-hand quantity to open #895 / MISE-005RI
- Leave setup inventory `parLevel` to open #894 / MISE-005RH
- Leave inventory detail / Log Delivery / count / Orders quantity tips alone

## Landing notes

Alone-OK with #896 / #895 / #894 / #893 / #892 / #891 / #890 / #889. Keep
`setupDraftsRecipeIngredientQuantityIdentity.ts` separate from
`setupRecipeIngredientQuantityIdentity.ts` (#896),
`setupInventoryQuantityIdentity.ts` (#895),
`setupInventoryParLevelIdentity.ts` (#894), and sibling quantity modules.
When landing with #896, do not merge the two recipe-ingredient quantity
modules; #896 owns setup.tsx validate/normalize, this tip owns setup-drafts
baseline / readiness identity.

## Verification

- focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `npm run security:backend`
- `npm test`: 687 total / 680 pass / 0 fail / 7 cancelled (inherited
  `recalculationCycles` on main; tip +4 vs main ~683)
