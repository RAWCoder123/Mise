# MISE-005LT daily-report restaurant workspace ASCII C

Date: 2026-10-09
Branch: `cursor/mise-daily-report-restaurant-ascii-c`
Base: `origin/main` @ `78da737`

## Gap

Unicode `String.trim()` on `services/application/dailyReport.ts` could invent a
restaurant workspace identity from NBSP / em-space padding before daily ops
report assembly. Demo tenants use non-UUID workspace tokens, so the fix pins
ASCII-only end trim without requiring UUID shape.

## Change

- Added `services/domain/dailyReportRestaurantIdentity.ts` with ASCII-C end trim,
  canonicalize, and fail-closed require preserving `Missing restaurant workspace.`
- Routed `fetchDailyOpsReport` through `requireCanonicalDailyReportWorkspaceId`.
- Added `tests/dailyReportRestaurantAsciiC.test.ts` inventing proofs.
- Left finding-decisions (#749), deliveries (#748), orders, waste, findings,
  activity, and other sibling restaurant tips untouched.

## Verification

- `npm run typecheck`
- focused `dailyReportRestaurantAsciiC` tests
- `npm test`
- `npm run security:static`
- `npm run security:backend`
