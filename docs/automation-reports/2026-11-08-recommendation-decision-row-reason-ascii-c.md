# MISE-005ZX: pin RecommendationDecisionRow recommendation.reason to ASCII C

Date: 2026-11-08  
Branch: `cursor/mise-recommendation-decision-row-reason-ascii-c`  
Baseline: `origin/main` @ `78da7376`

## Summary

Orders review `RecommendationDecisionRow` always passed raw
`recommendation.reason` into the expanded reason Text. Those reasons embed
free-form inventory `item.item_name` via `recommendationReason` /
`learnedRecommendationReason` / rising-trend `getWhyItMatters`, and
operating-plan why selection Unicode-trims stored reason
(`recommendation?.reason?.trim()`). Empty / Unicode-only-space reasons
rendered blank-looking expanded reason bodies; Unicode `.trim()` on padded
reasons would invent a clean reason before display.

## Changes

- Add `services/domain/presentationRecommendationDecisionRowReasonIdentity.ts`
  (multiline operator_note ASCII C prep; soft-null on empty / Unicode-padded /
  unsafe controls)
- Route RecommendationDecisionRow `{recommendation.reason}` through
  `normalizeRecommendationDecisionRowReason` so unsafe reasons fall through to
  new localized `orders.recommendation.reason.none` (EN Reason / ES Motivo /
  zh-Hans 原因)
- Leave RecommendationDecisionRow item_name (#1055), Orders review
  supplier_name (#1051), Inventory detail item_name / supplier_name
  (#1017 / #1052), SupplierDraftCard surfaces (#1050 / #972), Home
  ApprovalsSection whyItMatters / recommendedAction (#1135 / #1134), Daily
  Report signal.line (#1179), and operating-plan why tokens (#865) alone

## Inventing / bypass proof

- `Boolean("\u2003") === true` previously still rendered as the full
  expanded reason Text with no localized none fallback
- `"\u2003Roma Tomatoes is below reorder level.\u2003".trim() ===
  "Roma Tomatoes is below reorder level."` inventing equality (domain
  item_name embed + operating-plan reason.trim path)
- Source path: free-form `item.item_name` → `recommendationReason` /
  `getWhyItMatters` → stored `recommendation.reason` → always-pass
  `{recommendation.reason}`
- ASCII C soft-null restores `orders.recommendation.reason.none`

## Verification

- Focused `tests/recommendationDecisionRowReasonAsciiC.test.ts` — 5/5
- Assertion call sites counted from source: **56**
- `npm run typecheck`
- `npm run security:static` / `security:backend` / `design:static`
- `npm test`
- No migration

## Alone-OK

Beside #1055 / #1051 / #1017 / #1052 / #1050 / #972 / #1135 / #1134 / #1179 /
#865 / #662 (no shared identity modules; ordinary conflict only on
`RecommendationDecisionRow.tsx` / `i18n/catalog.ts`; no migration).

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
