# MISE-005XE Daily Report deliveries.line itemName ASCII C (2026-11-03)

## Defect

Daily Report deliveries always interpolated raw `line.itemName` into
`dailyReport.deliveries.line`. Empty / Unicode-only-space names rendered
blank-looking item identity with no intentional localized fallback. Unicode
`.trim()` on padded names would invent a clean item label.

## Fix

- `presentationDailyReportDeliveriesLineItemNameIdentity.ts` — ASCII C
  single-line prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeDailyReportDeliveriesLineItemName` before
  `dailyReport.deliveries.line` interpolation
- Localized fallback `dailyReport.deliveries.line.itemName.none`
  (EN/ES/zh-Hans)

## Alone-OK

Leaves Daily Report waste.topItem itemName (#1064), sales top-sellers
item.itemName (#1063), waste.event.unknownItem paths (#1018 — dailyWasteActionCopy /
Waste screen), supplier.supplierName (#1053), Log Delivery history entry.itemName
(#1062), and React list keys alone.

## Verification

- focused `tests/dailyReportDeliveriesLineItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
