# Inventory Count Fail-Closed Refresh Design

## Problem

The inventory-count screen retains the last successful session detail during a
soft refresh. Save and submit paths already guard on `actionsEditable`, but
approve and cancel remained reachable because they depended on stale
`visibleDetail` derived from `loadedRestaurantId` alone. The screen still
rendered cached count lines while hub readiness was `error`. The start-session
handler no-oped when not editable, but its button still looked enabled.

This can make stale system quantities look authoritative beside a retry notice
and makes an unavailable action appear interactive.

## Approaches considered

1. **Gate presentation with the existing hub readiness state (recommended).**
   Derive `hubReady` before `visibleDetail`, expose detail only while ready, and
   use the existing `actionsEditable` value for the start button. This follows
   the established restaurant-scoped screen contract and keeps the last
   successful response cached for a retry without rendering it as current.
2. **Clear detail and drafts in the load-error handler.** This hides stale data,
   but clearing on load error immediately destroys local state and conflates
   cache with presentation. A successful retry rehydrates from server values
   rather than preserving in-memory drafts.
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

The start / no-session panel is absent while the hub is not ready (loading or
hub load error). After a successful no-session load, the panel renders when
`hubReady` is true and there is no active count surface to show (no open
session, or approved/cancelled). During a genuine load error the panel stays
hidden so the screen does not imply there is no current count; the retry notice
may be the only content below the screen chrome. When the panel is shown, the
start button uses `disabled={!actionsEditable}` so insufficient permission and
in-flight mutations disable the control visibly. Mutation and validation errors
keep `hubReady` true so an in-progress session sheet remains visible while the
operator corrects input.

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
