# MISE-005RV: pin setup-drafts POS CSV lines to ASCII C

Date: 2026-10-27  
Branch: `cursor/mise-setup-drafts-pos-csv-line-ascii-c`

## Inventing proof

`services/domain/setupDrafts.ts` `parseSetupPosSalesCsv` fed each
newline-split POS CSV line through `line.trim()` before header detection,
`splitCsvLine`, and durable accepted POS sales rows / fingerprints.

Unicode trim invents a clean CSV line
(`'\u2003' + '2026-08-01,Chicken Bowl,Mains,2,20' + '\u2003').trim() ===
'2026-08-01,Chicken Bowl,Mains,2,20'`). Soft-empty Unicode-only space invented
an empty line that the empty filter dropped.

Open #872 / MISE-005QL pins setup POS `itemName` / `category` cell prep — not
this full-line sink. Open #871 / MISE-005QK pins setup POS `saleDate` cell
prep — not this full-line sink. Open #907 / MISE-005RU pins demo
recipe-baseline full-line trim — a distinct path; left alone.

## Change

- Add `services/domain/setupDraftsPosCsvLineIdentity.ts` (MISE-005RV)
- Soft empty / Unicode-only space → `empty`
- ASCII whitespace still trims clean before CSV parse
- Unicode-padded / control → `invalid` (skip that line)
- Wire `parseSetupPosSalesCsv` through `prepareSetupDraftsPosCsvLineText`
- Leave `(record.itemName ?? "").trim()` / `(record.category ?? "").trim()`
  (#872), `normalizeSaleDate(...)` (#871), setup-drafts dishName (#900), and
  demo recipe-baseline `line.trim()` (#907) alone

## Verification

- Focused AsciiC 4/4
- `npm run typecheck`
- `npm run security:static` / `security:backend`
- `npm test` (expected tip +4 vs main; inherited recalculationCycles
  cancellations OK)
- Docker pgTAP unavailable in this environment

## Merge note

Alone-OK with #872/#871/#907/#900/#899/#898/#897. Keep
`setupDraftsPosCsvLineIdentity.ts` separate from
`setupPosItemLabelIdentity.ts` / `setupPosSaleDateIdentity.ts` /
`demoRecipeBaselineLineIdentity.ts` / `setupDraftsRecipeDishNameIdentity.ts`.
When landing with #907, drop that tip’s bare setup-drafts
`.map((line) => line.trim())` assertion once this tip owns that path. When
landing with #872/#871, drop this tip’s bare itemName/category/saleDate
assertions once those tips own those paths.
