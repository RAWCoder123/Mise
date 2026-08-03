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

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
