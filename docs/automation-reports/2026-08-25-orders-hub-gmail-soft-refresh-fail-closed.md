# Orders hub Gmail soft-refresh fail-closed (2026-08-25)

## Gap

On soft-refresh load failure, Orders set `loadError` and hid restaurant-scoped
rows via `hubReady ? … : null/[]`. The drafts-lane Gmail card then fell through
`visibleEmailConnection?.status ?? "not_connected"` to **Link Gmail** / ready
copy. Operators could read a failed Orders refresh as a disconnected sender.
Empty lane states also claimed “no drafts / no sent / no history” while the hub
was unavailable.

## Closed

- Gmail card presents **Unavailable** (danger tone) when hub load state is `error`
- Link / Manage / Reconnect CTA is suppressed while unavailable (RetryNotice remains)
- Lane empty states are suppressed while unavailable so failed refresh is not
  presented as an empty restaurant
- `captureMiseError` records load failures with Orders flow metadata
- Last-known email connection remains in state for recovery and is not rendered
  as authority while errored
- EN / ES / zh-Hans catalog keys for unavailable title and body

## Paths

- `app/(tabs)/orders.tsx`
- `i18n/catalog.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/pilotUiSafety.test.ts`
- `tests/ordersUi.test.ts`
- `docs/automation-reports/2026-08-25-orders-hub-gmail-soft-refresh-fail-closed.md`

## Verification

- `npm run typecheck`
- Targeted: `clientTenantSafety`, `pilotUiSafety`, `ordersUi`, `hubLoadState`

## Coordination

- Open #145 also edits `orders.tsx` for pilot readiness gating; this change is
  limited to soft-refresh Gmail / empty-state fail-closed and should rebase
  cleanly beside the readiness gate.
- Does not redo Settings hub (#165), Gmail detail (#163), or POS detail (#164).

## Next related

1. Sync→planning correlation after #130/#132 merge/rebase.
2. Server-side readiness revalidation inside `approve_purchase_recommendation`
   (Codex/migration).
3. Merge/rebase coordination for open soft-refresh and readiness drafts (#145,
   #163–#165).
