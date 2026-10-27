# MISE-005RX: pin setup-drafts POS CSV grossSales to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-pos-gross-sales-ascii-c`

## Inventing proof

`services/domain/setupDrafts.ts` `parseSetupPosSalesCsv` Unicode-trimmed every
CSV cell (including `grossSales`) and then ran `parseSetupNumber`, whose
`/[$,\s]/g` strip uses ECMAScript `\s` (NBSP / em-space) before `Number`.

Unicode trim / `\s` invent a clean amount
(`'\u200320\u2003'.trim() === '20'` /
`'\u200320\u2003'.replace(/[$,\s]/g, "") === '20'` → `Number(...) === 20`). Soft
empty Unicode-only space invented the empty → NaN → `gross_sales` review
branch. Interior em-space
(`'20\u20030'.replace(/[$,\s]/g, "") === '200'`) invents through the same
`\s` strip.

Open #909 / MISE-005RW pins setup-drafts POS `quantitySold` — not this
grossSales sink. Open #872 / MISE-005QL pins setup POS `itemName` / `category`.
Open #871 / MISE-005QK pins `saleDate`. Open #908 / MISE-005RV pins full-line
trim. Leave `quantitySold` on `parseSetupNumber` until #909 lands.

## Change

- Add `services/domain/setupDraftsPosGrossSalesIdentity.ts` (MISE-005RX)
- Soft empty / Unicode-only space → `empty` (same gross_sales review)
- ASCII whitespace still trims clean before `$` / `,` / ASCII-space strip and
  `Number`
- Unicode-padded / control / non-finite → `invalid` (gross_sales review)
- Wire `parseSetupPosSalesCsv` through `prepareSetupDraftsPosGrossSalesText`
  and pass raw `grossSales` cells (no Unicode cell trim)
- Leave `parseSetupNumber(quantitySold)` (#909),
  `(record.itemName ?? "").trim()` / `(record.category ?? "").trim()` (#872),
  `normalizeSaleDate(...)` (#871), and `.map((line) => line.trim())` (#908)
  alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles
  cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #909/#872/#871/#908/#897/#896/#895. Keep
`setupDraftsPosGrossSalesIdentity.ts` separate from
`setupDraftsPosQuantitySoldIdentity.ts` / `setupPosItemLabelIdentity.ts` /
`setupPosSaleDateIdentity.ts` / `setupDraftsPosCsvLineIdentity.ts` /
`setupDraftsRecipeIngredientQuantityIdentity.ts`. When landing with #909,
compose selective raw-cell handling for `grossSales` with `quantitySold`
(`header === "quantitySold" || header === "grossSales" ? raw : raw.trim()`).
When landing with #872, compose selective raw-cell handling for `grossSales`
with itemName/category. When landing with #908, drop this tip’s bare
`.map((line) => line.trim())` assertion once #908 owns that path. Do not tip
`quantitySold` through this module.
