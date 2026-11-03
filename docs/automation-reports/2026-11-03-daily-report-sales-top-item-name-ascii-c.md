# MISE-005XC Daily Report sales top-sellers itemName ASCII C (2026-11-03)

## Defect

Daily Report sales top-sellers always interpolated raw `item.itemName` into
`dailyReport.sales.topItemLine`. Empty / Unicode-only-space names rendered
blank-looking item identity with no intentional localized fallback. Unicode
`.trim()` on padded names would invent a clean item label.

## Fix

- `presentationDailyReportSalesTopItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeDailyReportSalesTopItemName` before
  `dailyReport.sales.topItemLine` interpolation
- Localized fallback `dailyReport.sales.topItem.itemName.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves Daily Report waste.topItem itemName, deliveries.line itemName,
waste.event.unknownItem paths (#1018), supplier.supplierName (#1053),
Log Delivery history entry.itemName (#1062), and React list keys alone.

## Verification

- focused `tests/dailyReportSalesTopItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
