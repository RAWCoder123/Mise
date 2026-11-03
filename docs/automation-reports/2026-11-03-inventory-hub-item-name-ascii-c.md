# MISE-005WV — Inventory hub item.item_name ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-inventory-hub-item-name-ascii-c`

## Defect

Inventory hub list `InventoryListRow` always rendered raw `item.item_name` into
the OperationalRow title and into accessibility interpolations:

```ts
title={item.item_name}
```

Empty string rendered a blank-looking item identity. A Unicode-only-space item
name (`"\u2003"`) is truthy and rendered the same blank-looking identity.
Unicode `.trim()` on a padded item name would invent a clean display label
(`"\u2003Roma Tomatoes\u2003".trim() === "Roma Tomatoes"`).

## Fix

- `services/domain/presentationInventoryHubItemNameIdentity.ts` —
  ASCII C single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `app/(tabs)/inventory.tsx` — OperationalRow title + a11y item token through
  `normalizeInventoryHubItemName` with localized `inventory.row.itemName.none`
  fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/inventoryHubItemNameAsciiC.test.ts`

## Alone-OK

Leaves Inventory detail item_name (#1017), Inventory detail supplier_name
(#1052), RecommendationDecisionRow item_name (#1055), Orders review
recommendation.supplier_name (#1051), SupplierDraftCard supplier_name (#1050),
SupplierDraftCard line.itemName (#972), Orders hub notice `item_name`
interpolations, inventory count `line.item_name`, hub search/filter matching,
and inventoryPresentation prediction why copy alone.

## Verification

- focused `tests/inventoryHubItemNameAsciiC.test.ts`: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited
  recalculationCycles `withTimeout`); tip +5 vs main focused suite
- Docker pgTAP unavailable in this environment
