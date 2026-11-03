# MISE-005XM Waste action reviewItem a11y itemName ASCII C (2026-11-03)

## Defect

Waste top-items rows always interpolated raw `item.itemName` into
`waste.action.reviewItem` accessibility labels. Empty / Unicode-only-space
names rendered blank-looking item identity with no intentional localized
fallback. Unicode `.trim()` on padded names would invent a clean item label.

## Fix

- `presentationWasteActionReviewItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeWasteActionReviewItemName` before
  `waste.action.reviewItem` a11y interpolation
- Localized fallback `waste.action.reviewItem.item.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves OperationalRow `title={item.itemName}` display, waste.event.unknownItem
paths (#1018 / MISE-005VJ), Daily Report waste.topItem (#1064 / MISE-005XD),
Daily Report sales top-sellers (#1063), Inventory hub item.item_name (#1056),
RecommendationDecisionRow item_name (#1055), and Create Task list-row a11y
title (#1072) alone.

## Verification

- focused `tests/wasteActionReviewItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
