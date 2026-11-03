# MISE-005WX: Inventory count line.item_name ASCII C

**Date:** 2026-11-03  
**Branch:** `cursor/mise-inventory-count-line-item-name-ascii-c`

## Defect

Inventory count sheet always rendered raw `line.item_name` into the count-line
title and into `inventory.count.countedAccessibility` /
`inventory.count.noteAccessibility` interpolations.

- Empty / Unicode-only-space names rendered blank-looking item identity with no
  intentional localized fallback.
- Unicode `.trim()` on padded names would invent a clean item label before
  display.

## Change

- Add `normalizeInventoryCountLineItemName` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold).
- Route Inventory count line title + a11y item tokens through soft-null before
  `|| t("inventory.count.itemName.none")`.
- EN / ES / zh-Hans none copy in `i18n/catalog.ts`.
- Focused inventing / bypass proofs in
  `tests/inventoryCountLineItemNameAsciiC.test.ts`.

## Ownership

Owns only Inventory count sheet `line.item_name` →
`inventory.count.itemName.none` presentation (line title + counted/note
accessibility item tokens). Does **not** own Inventory hub item.item_name
(#1056), Inventory detail item_name (#1017), Inventory detail supplier_name
(#1052), RecommendationDecisionRow item_name (#1055), Orders hub notice
item_name (#1057), SupplierDraftCard line.itemName (#972), count subtitle
restaurant.name (#1040), or draft count/note field values.

## Verification

- focused tip tests
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
