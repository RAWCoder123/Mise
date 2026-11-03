# MISE-005WW — Orders hub notice item_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-orders-hub-notice-item-name-ascii-c`

## Defect

Orders hub always interpolated raw recommendation `item_name` into StatusNotice
and undo-toast copy:

```ts
t("orders.notice.approved", { item: approved.item_name })
t("orders.notice.dismissed", { item: dismissed.item_name })
t("orders.notice.undoRestored", { item: restored.item_name })
{ item: visibleUndoAction.recommendation.item_name }
```

Empty string rendered a blank-looking item identity. A Unicode-only-space item
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded item name would invent a clean display label
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).

## Fix

- `services/domain/presentationOrdersHubNoticeItemNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/(tabs)/orders.tsx` — approve / dismiss / undo-restored notices plus undo
  toast text and a11y labels through `normalizeOrdersHubNoticeItemName` with
  localized `orders.notice.itemName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/ordersHubNoticeItemNameAsciiC.test.ts`

## Alone-OK

Leaves RecommendationDecisionRow item_name (#1055), Inventory hub item.item_name
(#1056), Inventory detail item_name (#1017), Inventory detail supplier_name
(#1052), Orders review recommendation.supplier_name (#1051), SupplierDraftCard
supplier_name (#1050), SupplierDraftCard line.itemName (#972), inventory count
`line.item_name`, and `orders.notice.copied` supplier interpolations alone.

## Verification

- focused `tests/ordersHubNoticeItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +5 vs main focused suite
- Docker pgTAP unavailable in this environment
