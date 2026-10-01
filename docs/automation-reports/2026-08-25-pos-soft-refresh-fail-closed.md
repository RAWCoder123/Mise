# POS soft-refresh fail-closed (2026-08-25)

## Gap

Soft-refresh load failure set `hubLoadError` and hid Square connection via
`hubReady ? integration : null`, so the OperationalHero fell through to
`pos.hero.connectSource` / `pos.status.squareReady`. Operators could read a
failed refresh as disconnected. The Square card also showed perpetual
`common.loading` while `!hubReady`, including the error state.

## Closed

- Hero presents unavailable copy and danger tone when hub load state is `error`
- Dedicated danger StatusNotice with `common.retry` + accessibility label
- Connect / disconnect / sync remain locked until `hubReady`
- Last-known integration retained in state for recovery; not rendered as
  authority while errored
- Square card meta shows unavailable instead of endless loading on error
- `captureMiseError` on load failure
- EN / ES / zh-Hans: unavailable hero/status/meta strings and clearer load body

## Paths

- `app/settings/pos.tsx`
- `i18n/catalog.ts`
- `tests/clientTenantSafety.test.ts`
- `tests/pilotUiSafety.test.ts`
- `docs/automation-reports/2026-08-25-pos-soft-refresh-fail-closed.md`

## Verification

- `npm run typecheck`
- Targeted `npm test` for clientTenantSafety + pilotUiSafety
