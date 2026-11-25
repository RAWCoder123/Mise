# Inventory Count Fail-Closed Refresh Design

## Problem

The inventory-count screen retains the last successful session detail during a
soft refresh. Its shared hub state correctly becomes `error`, so mutations
already no-op, but the screen still renders the cached count lines because
`visibleDetail` checks only `loadedRestaurantId`. The start-session button also
looks enabled during that error even though its handler refuses to run.

This can make stale system quantities look authoritative beside a retry notice
and makes an unavailable action appear interactive.

## Approaches considered

1. **Gate presentation with the existing hub readiness state (recommended).**
   Derive `hubReady` before `visibleDetail`, expose detail only while ready, and
   use the existing `actionsEditable` value for the start button. This follows
   the established restaurant-scoped screen contract and keeps the last
   successful response cached for a retry without rendering it as current.
2. **Clear detail and drafts in the load-error handler.** This hides stale data,
   but couples cache destruction to presentation state and discards useful
   local values before a successful retry.
3. **Introduce a new screen-specific async state machine.** This could encode
   loading, empty, ready, and error separately, but duplicates the shared hub
   state helper for a two-line behavior correction.

## Design

`app/inventory/count.tsx` will track hub refresh failures in a dedicated
`hubLoadError` boolean, following the same pattern as `app/settings/recipes.tsx`.
`resolveRestaurantScopedHubLoadState` receives `loadError: hubLoadError`, not
`Boolean(error)`, because `error` also carries validation and mutation messages
that must not change hub readiness.

The screen will calculate `hubLoadState` and `hubReady` before deriving
`visibleDetail`. `visibleDetail` will be `detail` only when `hubReady` is
true. A soft-refresh load error will show the existing retry notice without
stale session lines, progress, or approval controls, and cached `detail` and
draft values are preserved in state rather than cleared in the load handler.

The start / no-session panel renders only when `hubReady` is true and there is
no active count surface to show (no open session, or approved/cancelled). During
a genuine load error the panel is hidden so the screen does not imply there is
no current count; the retry notice may be the only content below the screen
chrome. The start button uses `actionsEditable` so it is visibly disabled
during loading, hub load errors, insufficient permission, and mutations.
Mutation and validation errors keep `hubReady` true so an in-progress session
sheet remains visible while the operator corrects input.

No service API, repository, domain rule, schema, localization copy, or
dependency changes are required.

## Error handling and testing

The existing retry notice and request-generation checks remain authoritative.
A focused source-contract test will register the inventory-count route as a
shared fail-closed hub consumer and assert both readiness-gated detail and the
readiness-gated start button. The test must fail on the current implementation
before the screen changes.

Verification will include the focused test, TypeScript checking, static design
and security checks, and the mobile route/layout smoke tests.
