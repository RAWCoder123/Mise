# Log Delivery selected.item_name ASCII-C (MISE-005WZ)

## Defect

Log Delivery always passed raw `selected.item_name` into the selected-form
Screen subtitle and StatusNotice title. Empty / Unicode-only-space names
rendered blank-looking item identity; Unicode `.trim()` on padded names invents
a clean item label.

## Change

- Add `normalizeLogDeliverySelectedItemName` (ASCII end trim; soft-null Unicode
  padding / controls; preserve NBSP — no fold).
- Route Log Delivery selected Screen subtitle + StatusNotice title through
  soft-null before `|| t("logDelivery.selected.itemName.none")`.
- EN / ES / zh-Hans none copy in `i18n/catalog.ts`.
- Focused inventing / bypass proofs in
  `tests/logDeliverySelectedItemNameAsciiC.test.ts`.

## Ownership

Owns only Log Delivery selected `selected.item_name` →
`logDelivery.selected.itemName.none` presentation (Screen subtitle +
StatusNotice title). Leaves pick-list `item.item_name` (#1059), history
`entry.itemName`, Scan Item row titles, and sibling inventory/orders tips alone.
