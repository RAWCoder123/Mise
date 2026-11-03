# Log Delivery history entry.itemName ASCII-C (MISE-005XB)

## Defect

Log Delivery always passed raw `entry.itemName` into the history list card
title. Empty / Unicode-only-space names rendered blank-looking item identity;
Unicode `.trim()` on padded names invents a clean item label.

## Change

- Add `normalizeLogDeliveryHistoryItemName` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold).
- Route Log Delivery history card titles through soft-null before
  `|| t("logDelivery.history.itemName.none")`.
- EN / ES / zh-Hans none copy in `i18n/catalog.ts`.
- Focused inventing / bypass proofs in
  `tests/logDeliveryHistoryItemNameAsciiC.test.ts`.

## Ownership

Owns only Log Delivery history `entry.itemName` →
`logDelivery.history.itemName.none` presentation (history card title). Leaves
selected `selected.item_name` (#1060), pick-list `item.item_name` (#1059),
Scan Item row titles (#1061), history `entry.note`, and sibling inventory/orders
tips alone.
