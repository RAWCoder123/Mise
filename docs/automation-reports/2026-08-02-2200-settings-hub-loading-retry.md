# Settings hub loading + retry polish (2026-08-02)

## Gap
Settings hub treated unloaded supplier, Gmail, and recipe coverage as empty/not-connected:
- Restaurant switch and first paint flashed “No suppliers” / “Not connected”.
- Load failures asked operators to reopen the screen with no retry control.

## Change
- Soft-refresh hub load (Orders pattern): full-screen loading only for first paint / restaurant switch.
- `RetryNotice` with `load(true)` on failure.
- Presentation helpers keep loading/error copy distinct from true empty/disconnected states.
- i18n: EN / ES / zh-Hans keys for retry, loading, and unavailable hub rows.

## Verification
- `npm run typecheck`
- `npm test` — 399 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`
- Docker `supabase:test` unavailable in this environment

## Branch
`cursor/mise-product-inspection-48f9` (FF from `1abd` tip + this work)
