# MISE-005AAT: pin Insights analytics categoryMix slice.label to ASCII C

Date: 2026-11-09  
Branch: `cursor/mise-insights-category-mix-label-ascii-c`  
Baseline: `origin/main` at MISE-005A (`78da7376`)

## Summary

Insights SalesAnalyticsBoard always-passed free-form `categoryMix` `slice.label`
values through `localizeMixLabel` into category-mix DonutChart legend chrome.
Empty / Unicode-only-space labels rendered blank-looking category identity;
Unicode `.trim()` on padded labels would invent a clean menu-category label.

## Changes

- Add `services/domain/presentationInsightsCategoryMixLabelIdentity.ts` (ASCII C
  single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Insights `categorySlices` legend labels through
  `normalizeInsightsCategoryMixLabel` so unsafe labels fall through to localized
  `insights.analytics.categoryMix.label.none` (EN/ES/ZH `"Uncategorized"` /
  `"Sin categoría"` / `"未分类"`)
- Leave Insights sales aggregation labels (#869), best-sellers itemName (#1196),
  sourceMix always-pass labels (#1204), providerSaleIdentity (#673), and
  profile/subtitle restaurant/cuisine tips alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the DonutChart
  legend label with no localized none fallback
- `"\u2003Mains\u2003".trim() === "Mains"` inventing equality
- ASCII C soft-null restores `insights.analytics.categoryMix.label.none`

## Verification

- Focused `tests/insightsCategoryMixLabelAsciiC.test.ts` (5/5; 52 assertion call
  sites counted from source)
- `npm run typecheck`
- `npm test` 688 total / 681 pass / 0 fail / 7 cancelled (inherited withTimeout
  cancelledByParent; fixed in #1183, not landed)

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

## Alone-OK

Beside #869 / #1196 / #1204 / #673 / #969 / #970 / #1029 / #1037 (ordinary
conflict only on `app/(tabs)/insights.tsx` + new identity module + catalog
keys; no migration).
