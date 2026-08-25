# Settings hub soft-refresh fail-closed (2026-08-25)

## Gap

On soft-refresh load failure, Settings set `hubLoadError` and hid restaurant-scoped
rows via `hubReady ? … : null/[]`. The Gmail integration row then fell through
`gmailConnectionBadge(null)` to **Not connected**, and Suppliers showed **0**.
Operators could read a failed refresh as a disconnected Gmail sender or an empty
supplier directory. The danger notice also asked them to reopen the screen
instead of offering an in-place Retry.

## Closed

- Gmail row presents **Unavailable** (danger tone) when hub load state is `error`
- Supplier count presents **Unavailable** instead of `0` while errored; omits the
  count while still loading
- Dedicated danger `StatusNotice` with body copy + `common.retry` and an
  accessibility label
- Restaurant-scoped menu actions remain locked until `hubReady`
- Last-known email connection is retained in state for recovery and is not
  rendered as authority while errored
- EN / ES / zh-Hans catalog keys for unavailable status, load body, and retry a11y

## Paths

- `app/(tabs)/settings.tsx`
- `i18n/catalog.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/pilotUiSafety.test.ts`
- `docs/automation-reports/2026-08-25-settings-hub-soft-refresh-fail-closed.md`

## Verification

- `npm run typecheck`
- Targeted: `clientTenantSafety`, `pilotUiSafety`, `hubLoadState`

## Do not redo

- Claiming Gmail is disconnected solely because Settings soft-refresh failed
- Claiming supplier count is zero solely because Settings soft-refresh failed
- Overlapping Gmail detail soft-refresh work in #163 or POS detail in #164

## Next related

1. Orders hub still falls through `visibleEmailConnection?.status ?? "not_connected"`
   on soft-refresh error (coordinate with #145 if still open).
2. Sync→planning correlation after #130/#132 merge/rebase.
3. Server-side readiness revalidation inside `approve_purchase_recommendation`
   (Codex/migration).
