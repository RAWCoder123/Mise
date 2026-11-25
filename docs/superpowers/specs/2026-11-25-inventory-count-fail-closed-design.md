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

`app/inventory/count.tsx` will calculate `hubLoadState` and `hubReady` before
deriving `visibleDetail`. `visibleDetail` will be `detail` only when
`hubReady` is true. A load error will therefore show the existing retry notice
without stale session lines, progress, or approval controls.

The existing start-session surface remains the screen's no-detail fallback,
but its button will use `actionsEditable` so it is visibly disabled during
loading, errors, insufficient permission, and mutations. Successful loads with
no open session and successful loads with a current session retain their
existing behavior.

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
