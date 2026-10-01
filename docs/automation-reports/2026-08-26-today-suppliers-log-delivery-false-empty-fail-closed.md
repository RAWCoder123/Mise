# Today / Suppliers / Log Delivery soft-refresh false-empty fail-closed (2026-08-26)

Branch tip of this automation run. Base: `origin/main` @ `6eedbfb`.

## Gap

Soft-refresh load failures already cleared restaurant-scoped rows via
`hubReady ? … : null/[]`, but several hubs still rendered true-empty copy beside
`RetryNotice`:

- **Today** kept filter chrome and compact `DailyBriefBoard` with a null brief,
  which claims “No findings yet” / all-clear empty-day copy while the plan is
  actually unavailable.
- **Suppliers** showed “No suppliers yet” whenever `visibleEntries` was empty,
  including load-error and still-loading hub states.
- **Log Delivery** claimed “No deliveries yet” / “No matching items” and a `0`
  history count while inventory failed to refresh.

Open drafts #148 / #158 / #159 do not close these false-empty claims.

## Closed

- Today: `hubUnavailable` hides plan filters, timeline, floor notes, and Daily
  Brief; shows dedicated unavailable StatusNotice (EN / ES / zh-Hans).
- Suppliers: empty directory + configured count only when `hubReady`.
- Log Delivery: history/item empty states, history count, search, and “log new”
  stay suppressed or disabled while unavailable.
- Static pins in `clientTenantSafety`, `pilotUiSafety`, and `hubLoadState`.

## Paths

- `app/(tabs)/today.tsx`
- `app/settings/suppliers.tsx`
- `app/more/log-delivery.tsx`
- `i18n/catalog.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/pilotUiSafety.test.ts`
- `tests/hubLoadState.test.ts`
- `docs/automation-reports/2026-08-26-today-suppliers-log-delivery-false-empty-fail-closed.md`

## Coordination

- Do not redo Home/Activity (#150), Orders Gmail (#166), Insights (#167),
  Inventory (#168), draft-preserve (#155–#162), or Today readiness chips (#148).
- Suppliers / log-delivery draft-preserve PRs (#158 / #159) should rebase cleanly
  beside these empty-state gates.

## Next related

1. Sync→planning correlation after #130/#132 merge/rebase.
2. Server-side readiness revalidation inside `approve_purchase_recommendation`
   (Codex/migration).
3. Merge/rebase coordination for open soft-refresh and readiness drafts.
