# MISE-005WU — RecommendationDecisionRow item_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-recommendation-decision-row-item-name-ascii-c`

## Defect

Orders review `RecommendationDecisionRow` always rendered raw
`recommendation.item_name` into the itemName Text and into accessibility
interpolations:

```ts
<Text style={styles.itemName}>{recommendation.item_name}</Text>
```

Empty string rendered a blank-looking item identity. A Unicode-only-space item
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded item name would invent a clean display label
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).

## Fix

- `services/domain/presentationRecommendationDecisionRowItemNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `components/RecommendationDecisionRow.tsx` — itemName Text + a11y item tokens
  through `normalizeRecommendationDecisionRowItemName` with localized
  `orders.recommendation.itemName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/recommendationDecisionRowItemNameAsciiC.test.ts`

## Alone-OK

Leaves Orders review recommendation.supplier_name (#1051), Inventory detail
item_name (#1017), Inventory detail supplier_name (#1052), SupplierDraftCard
supplier_name (#1050), SupplierDraftCard line.itemName (#972), Orders hub notice
`item_name` interpolations, recommendation.reason free-text, and inventory hub
list `item.item_name` alone. Does not rewrite quantity/unit presentation or
purchase authority blockers.

## Verification

- focused `tests/recommendationDecisionRowItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +5 vs main focused suite
- Docker pgTAP unavailable in this environment
