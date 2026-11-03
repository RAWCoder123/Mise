# MISE-005XJ Inventory detail add-action a11y item_name ASCII C

Date: 2026-11-03

## Completed

- Soft-null blank, Unicode-padded, and control-bearing `item.item_name` values before Inventory detail "Add to Order" accessibility interpolation.
- Added `normalizeInventoryDetailAddAccessibilityItemName` (ASCII end trim; preserve NBSP; full C0/DEL reject).
- Added EN / ES / zh-Hans `inventory.detail.add.item.none`.
- Focused inventing / bypass proofs (5/5).

## Ownership

Owns only Inventory detail addAccessibility a11y **item → inventory.detail.add.item.none**. Leaves Inventory detail Screen title (#1017), Inventory hub (#1056), Inventory detail supplier_name (#1052), Inventory count line (#1058), Recipes ingredient (#1067), and waste itemName (#1018) alone.

## Verification

- focused tip tests: 5/5
- `npm run typecheck`: passed
- `npm run security:static`: passed
- `npm run security:backend`: passed
- `npm test`: 688 total / 681 pass / 0 fail / 7 cancelled (inherited `recalculationCycles`)
- Docker pgTAP unavailable in this environment

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
