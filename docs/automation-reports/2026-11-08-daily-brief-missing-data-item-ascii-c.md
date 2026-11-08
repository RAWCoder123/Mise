# MISE-005ZV: pin Daily Brief missingData items to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-daily-brief-missing-data-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Summary

Daily Brief Board always joined and passed raw
`finding.freshness.missingData` into `dailyBrief.missingData` `{items}`.
Unmapped POS sales embed free-form menu item names via
`menu_mapping:${name}` after `boundedText(sale.item_name, ...)` Unicode-trims
the name. Empty / Unicode-only-space tokens rendered blank-looking Missing
entries; Unicode `.trim()` on padded free-form names invents a clean
missing-data identity before the Board join.

## Changes

- Add `services/domain/presentationDailyBriefMissingDataItemIdentity.ts`
  (ASCII C single-line prep; soft-null on empty / Unicode-padded / controls)
- Route each Daily Brief Board missingData token through
  `normalizeDailyBriefMissingDataItem` before join so unsafe entries fall
  through to new localized `dailyBrief.missingData.item.none`
  (EN / ES / zh-Hans)
- Leave finding.title (#1145), explanation (#1142), affectedWorkflow
  (deferred), recommendedAction body, Phase Brief FindingRow surfaces
  (#1156 / #1157), and Daily Report signal.line (#1179) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered into the Missing
  join with no localized none fallback for that token
- `"\u2003Chicken Breast\u2003".trim() === "Chicken Breast"` inventing
  equality (domain `boundedText` / free-form menu name path into
  `menu_mapping:${name}`)
- Source path: unmapped POS `sale.item_name` → `boundedText` →
  `menu_mapping:${name}` → always-pass Board join
- ASCII C soft-null restores `dailyBrief.missingData.item.none`

## Verification

- Focused `tests/dailyBriefMissingDataItemAsciiC.test.ts` — 5/5
- Assertion call sites counted from source: **63**
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
