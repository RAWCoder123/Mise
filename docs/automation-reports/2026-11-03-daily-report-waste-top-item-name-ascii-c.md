# MISE-005XD Daily Report waste.topItem itemName ASCII C (2026-11-03)

## Defect

Daily Report waste analysis always interpolated raw
`wasteAnalysis.topItems[0].itemName` into `dailyReport.waste.topItem`. Empty /
Unicode-only-space names rendered blank-looking item identity with no
intentional localized fallback. Unicode `.trim()` on padded names would invent
a clean item label.

## Fix

- `presentationDailyReportWasteTopItemNameIdentity.ts` — ASCII C single-line
  prep (end trim only; preserve NBSP; full C0/DEL reject)
- Soft-null via `normalizeDailyReportWasteTopItemName` before
  `dailyReport.waste.topItem` interpolation
- Localized fallback `dailyReport.waste.topItem.itemName.none` (EN/ES/zh-Hans)

## Alone-OK

Leaves Daily Report sales top-sellers item.itemName (#1063), deliveries.line
itemName, waste.event.unknownItem paths (#1018 — dailyWasteActionCopy / Waste
screen), supplier.supplierName (#1053), Log Delivery history entry.itemName
(#1062), and React list keys alone.

## Verification

- focused `tests/dailyReportWasteTopItemNameAsciiC.test.ts`
- `npm run typecheck`
- `npm run security:static`
- `npm run security:backend`
- `npm test`
