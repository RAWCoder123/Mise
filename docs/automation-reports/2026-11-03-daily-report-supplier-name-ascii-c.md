# MISE-005WS — Daily report supplier.supplierName ASCII C

Date: 2026-11-03  
Branch: `cursor/mise-daily-report-supplier-name-ascii-c`

## Defect

Daily-report supplier reliability rows always rendered raw
`supplier.supplierName` into the signalType Text:

```ts
<Text style={styles.signalType}>{supplier.supplierName}</Text>
```

Upstream `buildSupplierReliabilitySummary` invented a clean supplier display
identity when seeding the accumulator:

```ts
supplierName: order.supplier_name.trim()
```

Unicode `.trim()` on a padded order supplier name invented a clean label
(`"\u2003Sysco\u2003".trim() === "Sysco"`) before the daily-report row
rendered. Empty string and Unicode-only-space names rendered blank-looking
supplier identity on the reliability row with no intentional localized
fallback.

## Fix

- `services/domain/presentationDailyReportSupplierNameIdentity.ts` — ASCII C
  single-line end trim; preserve NBSP; full C0/DEL reject; soft-null
- `services/domain/supplierReliability.ts` — accumulator seed through
  `normalizeDailyReportSupplierName` instead of Unicode `.trim()`
- `app/more/daily-report.tsx` — reliability row supplier through
  `normalizeDailyReportSupplierName` with localized
  `dailyReport.supplierReliability.supplierName.none` fallback
- `i18n/catalog.ts` — EN / ES / zh-Hans none copy
- Focused inventing + bypass proofs in
  `tests/dailyReportSupplierNameAsciiC.test.ts`

## Alone-OK

Leaves Inventory detail subtitle item.supplier_name (#1052), Orders review
recommendation.supplier_name (#1051), SupplierDraftCard order.supplier_name
(#1050), Orders detail title (#1016), miseDomain draft-order (#1034), and
Settings suppliers `entry.supplierName` alone.
