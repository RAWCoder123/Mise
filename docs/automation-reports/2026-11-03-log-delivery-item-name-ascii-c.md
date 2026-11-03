# MISE-005WY — Log Delivery pick-list item.item_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-log-delivery-item-name-ascii-c`

## Defect

Log Delivery pick list always rendered raw `item.item_name` into the
OperationalRow title and into accessibility interpolations:

```ts
title={item.item_name}
accessibilityLabel={t("logDelivery.row.accessibility", { item: item.item_name })}
```

Empty string rendered a blank-looking item identity. A Unicode-only-space item
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded item name would invent a clean display label
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).

## Fix

- `services/domain/presentationLogDeliveryItemNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/more/log-delivery.tsx` — OperationalRow title + a11y item token through
  `normalizeLogDeliveryItemName` with localized `logDelivery.row.itemName.none`
  fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/logDeliveryItemNameAsciiC.test.ts`

## Alone-OK

Leaves Scan Item row titles, Log Delivery selected StatusNotice / Screen
subtitle `selected.item_name`, history `entry.itemName`, Inventory hub
item.item_name (#1056), Inventory count line.item_name (#1058), Inventory
detail item_name (#1017), Inventory detail supplier_name (#1052),
RecommendationDecisionRow item_name (#1055), Orders hub notice item_name
(#1057), SupplierDraftCard line.itemName (#972), and Log Delivery
search/filter haystack matching alone.

## Verification

- focused `tests/logDeliveryItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip tests all pass
- Docker pgTAP unavailable in this environment
