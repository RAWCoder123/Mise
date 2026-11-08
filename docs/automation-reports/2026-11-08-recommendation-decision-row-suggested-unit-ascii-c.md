# MISE-005AAI: pin RecommendationDecisionRow suggested unit to ASCII C

Date: 2026-11-08

## Summary

Soft-null empty/Unicode-padded purchase recommendation units before composing
RecommendationDecisionRow suggested / quantity unit copy so blank identity
falls through to `orders.recommendation.unit.none` instead of inventing a
clean unit label or rendering blank-looking unit copy.

## Inventing proof

- Free-form `purchase_recommendations.unit` / `recommendation.unit`
- `"\u2003cs\u2003".trim() === "cs"` invents a clean unit via Unicode trim
- `"\u2003"` / `""` remain non-nullish/always-pass and render blank-looking
  suggested copy (`"Suggested 12  "`) and blank-looking quantity unit Text

## Scope

- `services/domain/presentationRecommendationDecisionRowSuggestedUnitIdentity.ts`
- `components/RecommendationDecisionRow.tsx` suggested / quantity unit display
  paths only
- `i18n/catalog.ts` EN/ES/ZH `orders.recommendation.unit.none`
- `tests/recommendationDecisionRowSuggestedUnitAsciiC.test.ts`

## Left alone

- RecommendationDecisionRow item_name (#1055)
- RecommendationDecisionRow reason (#1182)
- Inventory hub quantity unit (#1192)
- Inventory detail display unit (#1191)
- Scan Item quantity unit (#1193)
- setup inventory units (#861)
- inventory recipe-mapping units (#864)
- inventoryUnits client helpers (#669)
- controlled `inventory.ops.unit.${canonicalUnit}` labels
- No migration

## Verification

- `npm run typecheck`
- focused `tests/recommendationDecisionRowSuggestedUnitAsciiC.test.ts`
- assertion call sites counted from source: **70**
- `npm test`
