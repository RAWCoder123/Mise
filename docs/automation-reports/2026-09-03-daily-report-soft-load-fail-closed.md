# Daily Report soft-load fail-closed (2026-09-03)

## Problem

`fetchDailyOpsReport` soft-swallowed secondary feed failures:

- inventory outlooks → `[]`
- open operator tasks → `[]`
- supplier reliability → `null` (rendered as empty summary)
- waste analysis → `null`
- deliveries today → `[]`

That falsely claimed clear/empty closeout sections when loads failed. The Daily
Report screen also kept last-known report body visible beside `RetryNotice`
after a soft-refresh denial.

## Fix

- Propagate secondary feed failures so the whole Daily Report load fails closed.
- Keep Ask Mise briefing optional (generative explanation only).
- Gate report body with `resolveRestaurantScopedHubLoadState` / `hubReady`.
- Pin application and screen contracts in tests; add Daily Report to hub consumer lists.

## Paths

- `services/application/dailyReport.ts`
- `app/more/daily-report.tsx`
- `tests/dailyReportSoftLoad.test.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/hubLoadState.test.ts`

## Out of scope

- #329 waste/supplier attention ranking in `rankManagerActions` (domain only)
- Contested Today/Home operatingBrief soft-loads (#327/#328/#190/#172)
- Inventing MOQ / lead time / expiration

## Verification

- `npm run typecheck`
- focused soft-load + hub + tenant safety tests
- `npm test`
