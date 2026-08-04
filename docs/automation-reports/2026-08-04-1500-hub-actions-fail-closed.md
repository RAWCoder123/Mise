# Automation report — hub actions fail-closed (2026-08-04 15:00 UTC)

Branch: `cursor/mise-product-inspection-e479`

## Gap

Restaurant-scoped hubs already muted stale data via `resolveRestaurantScopedHubLoadState`, but Inventory create/count/waste cards, Settings restaurant-scoped rows/export/demo restore, and Insights refresh still used membership/session role alone. After a soft-refresh denial, those affordances could stay interactive while RetryNotice was showing.

## Fix

- Shared `presentRestaurantScopedHubActionsEditable` in `services/presentation/hubLoadState.ts`.
- Inventory / Settings / Insights presentation wrappers + screen wiring.
- `OperationalRow` gains `disabled` so Settings can keep restaurant rows visible but non-interactive.
- Open inventory count session id is muted until the hub is ready.

## Verification

- `npm run typecheck`
- `npm test` — 561/561
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof were not available in this workspace.

## Product state

Controlled pilot foundations remain; App Store / paid public launch still blocked on Docker/hosted security re-proof, founder HTTPS legal URLs, Apple Developer / TestFlight, and live POS/Gmail credentials.

## Next

Scan remaining deep-link mutation screens for stale membership editability without hub readiness, or continue ops gates when Docker/staging credentials return.
