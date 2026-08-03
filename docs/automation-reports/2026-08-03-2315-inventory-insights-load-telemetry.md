# Inventory and Insights hub load telemetry

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-68f8`

## Gap

`/inventory` and `/insights` already had soft-refresh and RetryNotice, but load (and Insights refresh) failures were swallowed without `captureMiseError`, unlike Today, Settings, and Orders hubs.

## Change

- `/inventory` load failures call `captureMiseError` with `flow: "inventory"`, `operation: "load"`.
- `/insights` load and manager refresh failures call `captureMiseError` with `flow: "insights"` and `operation: "load"` / `"refresh"`.
- Extended hub presentation wiring tests to require telemetry on those paths.

## Verification

- `npm run typecheck` — passed
- `npm test` — 514 passed, 0 failed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
