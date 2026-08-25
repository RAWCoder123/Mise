# Gmail soft-refresh fail-closed polish (2026-08-25)

## Problem

On soft-refresh load failure, Gmail settings cleared the visible connection via
`hubReady ? connection : null` and fell through to status `not_connected`. That
looked like a disconnected sender even when the prior load was connected, and
the load-error notice had no dedicated Retry action distinct from the status card.

## Change

- Keep last-known `connection` in component state on soft-refresh failure.
- Fail closed for mutations via shared hub readiness (`hubReady` / `actionsEditable`).
- Present status as `unavailable` (EN/ES/zh-Hans) instead of `not_connected`.
- Show a dedicated danger `StatusNotice` with Retry when `hubLoadError`.
- Capture load failures with `captureMiseError` for observability.
- Do not surface mutation notices over an active load-error retry surface.

## Paths

- `app/settings/gmail.tsx`
- `i18n/catalog.ts`
- `tests/gmailClient.test.ts`
- `tests/clientTenantSafety.test.ts`

## Verification

- `npm run typecheck`
- `npm test` (gmailClient + clientTenantSafety + hubLoadState pins)
