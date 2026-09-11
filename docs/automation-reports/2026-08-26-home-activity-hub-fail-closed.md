# Home + Activity hub soft-refresh fail-closed (2026-08-26)

Rebased onto `origin/main` @ `20b28e5`. Refreshes the unmerged #150 intent
(`cursor/mise-home-hub-fail-closed` @ `9a15545`, base `706590d`).

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
