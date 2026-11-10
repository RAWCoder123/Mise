# MISE-005ABO Log Delivery row a11y item.item_name ASCII C (2026-11-10)

## Defect

Log Delivery pick-list rows always interpolated raw `item.item_name` into
`logDelivery.row.accessibility` accessibility labels. Empty / Unicode-only-space
names rendered blank-looking item identity with no intentional localized
fallback. Unicode `.trim()` on padded names would invent a clean item label.

## Fix

- `presentationLogDeliveryRowItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeLogDeliveryRowItemName` before
  `logDelivery.row.accessibility` a11y interpolation
- Localized fallback `logDelivery.row.accessibility.item.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves OperationalRow `title={item.item_name}` display (#1059 / MISE-005WY),
Log Delivery selected.item_name (#1060 / MISE-005WZ), history entry.itemName
(#1062 / MISE-005XB), Scan Item row item.item_name display (#1061 / MISE-005XA),
and Waste reviewItem a11y (#1073 / MISE-005XM) alone.

## Verification

- focused `tests/logDeliveryRowItemNameAsciiC.test.ts` (5/5; 53 assertion call sites from source)
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm test` (688 total / 681 pass / 0 fail / 7 cancelled — inherited recalculationCycles)
