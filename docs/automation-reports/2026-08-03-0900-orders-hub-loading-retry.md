# Orders hub soft-refresh and false-empty polish

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-0840`
Base tip: `origin/cursor/mise-product-inspection-7018`

## Gap

`/orders` already soft-refreshed supplier recommendations, drafts, and Gmail connection state, but it had no hub load-state presenter. After an initial fetch failure, `RetryNotice` appeared alongside false-ready copy:

- Gmail card claimed “Send from restaurant Gmail” / not connected
- Draft, sent, and history lanes claimed true empty states
- Retry button fell back to the English `RetryNotice` default label

## Fix

- Added `services/presentation/ordersHubPresentation.ts` with:
  - `resolveOrdersHubLoadState`
  - `presentOrdersHubGmailCopy`
  - `presentOrdersHubLaneEmptyCopy`
- Orders hub now tracks `loadedRestaurantId`, gates visible recommendations/orders/email behind `hubReady`, and uses loading/unavailable presentation for Gmail and each lane empty state.
- Soft refresh after a successful load still keeps last-known data while surfacing `RetryNotice`.
- Localized `retryLabel` via `common.retry`.
- EN / ES / zh-Hans catalog keys for Gmail and lane loading/unavailable copy.
- Tests: `tests/ordersHubPresentation.test.ts`; tenant-safety wiring updated.

## Verification

- `npm run typecheck` — passed
- `npm test` — 440/440 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed (includes `/orders`)
- Docker `supabase:test` still unavailable in this environment
