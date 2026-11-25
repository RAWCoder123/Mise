# Home + Activity hub soft-refresh fail-closed (2026-08-25)

## Gap

Home was the only primary tab that still keyed visibility off
`loadedRestaurantId === restaurant.id` without
`resolveRestaurantScopedHubLoadState`. After a successful load, a later soft
refresh failure left the operating brief and one-tap recommendation approvals
visible and actionable beside `RetryNotice`.

Activity History had the same fail-open visibility pattern for its event feed
(read-only, but still presented prior-tenant/query evidence as current).

## Fix

- `app/(tabs)/home.tsx`
  - Soft-refresh: full-screen loading only on first paint / restaurant switch.
  - `hubReady` gates summary, brief, and recalculation attention.
  - `presentRestaurantScopedHubActionsEditable` gates one-tap approve.
- `app/more/activity.tsx`
  - Soft-refresh + query-change invalidation.
  - `hubReady` gates the event feed; empty state only when ready and empty.
- Pins in `tests/hubLoadState.test.ts`, `tests/clientTenantSafety.test.ts`, and
  `tests/pilotUiSafety.test.ts`.

## Why not pilot readiness

Open drafts #145 / #148 / #149 already own Home/Orders/Today/Ask readiness UI
gates. This change only closes the shared hub load-error fail-open path and
should rebase cleanly under those stacks.

## Verification

- `npm run typecheck`
- Focused: `tests/hubLoadState.test.ts`, `tests/clientTenantSafety.test.ts`,
  `tests/pilotUiSafety.test.ts`

## 2026-11-25 refresh

The branch was merged forward to current `origin/main` (`78da7376`) instead of
opening another overlapping draft. The refresh also closes two retry-state
gaps:

- Home invalidates prior readiness and shows blocking load feedback while
  retrying a failed refresh, so stale one-tap approvals cannot reappear before
  fresh evidence arrives.
- Activity History does the same after an initial or soft-refresh failure, so
  Retry never leaves a blank feed without loading or error feedback.

Fresh verification on the refreshed branch:

- `npm run typecheck`
- focused hub, tenant-safety, and pilot UI tests: 16 passed
- one `npm test` run completed with 685 passed, 0 failed, and 0 cancelled
  before the final query-readiness test was added
- the final 686-test run completed with 679 passed, 0 failed, and 7 cancelled;
  isolated reproduction confirms the inherited unref'd recalculation timeout
  cancels itself and its six sibling tests when the Node event loop drains
- the recalculation cancellation is already owned by
  [PR #1183](https://github.com/RAWCoder123/Mise/pull/1183); this branch does
  not duplicate that separate fix
- all other test files: 675 passed, 0 failed, 0 cancelled
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- `npm run qa:mobile-layout`: 27 routes at 390×844 with zero horizontal
  overflow
