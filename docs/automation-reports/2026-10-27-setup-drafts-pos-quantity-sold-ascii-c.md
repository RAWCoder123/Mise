# MISE-005RW: pin setup-drafts POS CSV quantitySold to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-pos-quantity-sold-ascii-c`

## Inventing proof

`services/domain/setupDrafts.ts` `parseSetupPosSalesCsv` Unicode-trimmed every
CSV cell (including `quantitySold`) and then ran `parseSetupNumber`, whose
`/[$,\s]/g` strip uses ECMAScript `\s` (NBSP / em-space) before `Number`.

Unicode trim / `\s` invent a clean quantity
(`'\u20032\u2003'.trim() === '2'` /
`'\u20032\u2003'.replace(/[$,\s]/g, "") === '2'` → `Number(...) === 2`). Soft
empty Unicode-only space invented the empty → NaN → `quantity_sold` review
branch.

Open #872 / MISE-005QL pins setup POS `itemName` / `category` — not this
quantitySold sink. Open #871 / MISE-005QK pins `saleDate`. Open #908 /
MISE-005RV pins full-line trim. Leave `grossSales` on `parseSetupNumber` until
its own tip.

## Change

- Add `services/domain/setupDraftsPosQuantitySoldIdentity.ts` (MISE-005RW)
- Soft empty / Unicode-only space → `empty` (same quantity_sold review)
- ASCII whitespace still trims clean before `$` / `,` / ASCII-space strip and
  `Number`
- Unicode-padded / control / non-finite → `invalid` (quantity_sold review)
- Wire `parseSetupPosSalesCsv` through `prepareSetupDraftsPosQuantitySoldText`
  and pass raw `quantitySold` cells (no Unicode cell trim)
- Leave `(record.itemName ?? "").trim()` / `(record.category ?? "").trim()`
  (#872), `normalizeSaleDate(...)` (#871), `parseSetupNumber(grossSales)`, and
  `.map((line) => line.trim())` (#908) alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles
  cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #872/#871/#908/#897/#896/#895. Keep
`setupDraftsPosQuantitySoldIdentity.ts` separate from
`setupPosItemLabelIdentity.ts` / `setupPosSaleDateIdentity.ts` /
`setupDraftsPosCsvLineIdentity.ts` /
`setupDraftsRecipeIngredientQuantityIdentity.ts`. When landing with #872,
keep the selective raw-cell branch for `quantitySold` and compose with
itemName/category raw handling. When landing with #908, drop this tip’s bare
`.map((line) => line.trim())` assertion once #908 owns that path. Do not tip
`grossSales` through this module.
