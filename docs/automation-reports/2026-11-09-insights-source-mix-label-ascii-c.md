# MISE-005AAS: pin Insights analytics sourceMix slice.label to ASCII C

Date: 2026-11-09  
Branch: `cursor/mise-insights-source-mix-label-ascii-c`  
Baseline: `origin/main` at MISE-005A (`78da7376`)

## Summary

Insights SalesAnalyticsBoard always-passed free-form `sourceMix` `slice.label`
values through `localizeMixLabel` into POS source-mix DonutChart legend chrome.
Empty / Unicode-only-space labels rendered blank-looking source identity;
Unicode `.trim()` on padded labels would invent a clean POS source label.

## Changes

- Add `services/domain/presentationInsightsSourceMixLabelIdentity.ts` (ASCII C
  single-line prep; soft-null on empty / Unicode-padded / controls)
- Route Insights `sourceSlices` legend labels through
  `normalizeInsightsSourceMixLabel` so unsafe labels fall through to localized
  `insights.analytics.sourceMix.label.none` (EN/ES/ZH `"POS"`)
- Leave Insights sales aggregation labels (#869), best-sellers itemName (#1196),
  categoryMix always-pass labels, providerSaleIdentity (#673), and
  profile/subtitle restaurant/cuisine tips alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the DonutChart
  legend label with no localized none fallback
- `"\u2003Square\u2003".trim() === "Square"` inventing equality
- ASCII C soft-null restores `insights.analytics.sourceMix.label.none`

## Verification

- Focused `tests/insightsSourceMixLabelAsciiC.test.ts` (5/5; 49 assertion call
  sites counted from source)
- `npm run typecheck`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.

## Alone-OK

Beside #869 / #1196 / #673 / #969 / #970 / #1029 / #1037 (ordinary conflict
only on `app/(tabs)/insights.tsx` + new identity module + catalog keys; no
migration).
