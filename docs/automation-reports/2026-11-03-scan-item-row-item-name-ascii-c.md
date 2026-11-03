# MISE-005XA — Scan Item row item.item_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-scan-item-row-item-name-ascii-c`

## Defect

Scan Item list rows always rendered raw `item.item_name` into the
OperationalRow title and into accessibility interpolations:

```ts
title={item.item_name}
accessibilityLabel={t("scanItem.row.accessibility", { item: item.item_name })}
```

Empty string rendered a blank-looking item identity. A Unicode-only-space item
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded item name would invent a clean display label
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).

## Fix

- `services/domain/presentationScanItemRowItemNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/more/scan-item.tsx` — OperationalRow title + a11y item token through
  `normalizeScanItemRowItemName` with localized `scanItem.row.itemName.none`
  fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/scanItemRowItemNameAsciiC.test.ts`

## Alone-OK

Leaves Log Delivery pick-list item.item_name (#1059), Log Delivery selected
selected.item_name (#1060), Log Delivery history `entry.itemName`, Inventory
hub item.item_name (#1056), Inventory count line.item_name (#1058), Inventory
detail item_name (#1017), Scan Item search/filter haystack matching, and
sibling supplier_name tips alone.

## Verification

- focused `tests/scanItemRowItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 688 pass / 0 fail / 0 cancelled
- Docker pgTAP unavailable in this environment
