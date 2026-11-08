# Daily Report deliveries.line.unit ASCII C (MISE-005AAJ)

Date: 2026-11-08
Branch: `cursor/mise-daily-report-deliveries-line-unit-ascii-c`
Base: `origin/main` @ `78da7376`

## Problem

Daily Report deliveries qty copy selected its unit suffix with:

```ts
`${formatNumber(line.quantity)}${line.unit ? ` ${line.unit}` : ""}`
```

Unicode-only-space / empty-looking units are truthy, so the notice rendered
blank-looking unit identity (`"12  "`). Unicode `.trim()` on em-space-padded
units would invent a clean unit identity if used as a prep gate before
interpolation.

## Changes

- Add `services/domain/presentationDailyReportDeliveriesLineUnitIdentity.ts`
  (single-line ASCII C end trim; preserve NBSP; soft-null on empty /
  Unicode-padded / unsafe controls)
- Route Daily Report deliveries qty unit through
  `normalizeDailyReportDeliveriesLineUnit(line.unit)` with soft-null → omit
  unit suffix (prior falsy quantity-only fallback)
- Leave Daily Report deliveries.line itemName (#1065), waste/sales itemName
  tips, Inventory hub/detail/Scan Item/RecommendationDecisionRow unit tips,
  deliveryHistory notes (#837), and controlled `inventory.ops.unit` labels alone

## Inventing / bypass proof

- `"\u2003cs\u2003".trim() === "cs"` inventing equality for a clean unit
- `"\u2003"` is truthy and previously forced a blank-looking qty unit suffix
- ASCII C soft-null restores the omit-unit quantity-only fallthrough

Distinct from Daily Report deliveries.line itemName (#1065 / MISE-005XE) and
from Inventory hub unit (#1192 / MISE-005AAG).

## Alone-OK

No migration. Alone-OK on main beside #1065 / #1194 / #1193 / #1192 / #1191 /
#1100–#1133; ordinary conflicts possible only if another tip rewrites the same
Daily Report deliveries qty unit interpolation.

## Verification

- Focused `tests/dailyReportDeliveriesLineUnitAsciiC.test.ts`
- `npm run typecheck`
- `npm test`

## Classification

Controlled pilot-ready integrity tip. Not App Store submission-ready.
