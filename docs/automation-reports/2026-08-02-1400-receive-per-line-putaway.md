# Per-line receive put-away (2026-08-02)

## Gap
Supplier-order receive already accepted optional per-line `storageLocationId` in domain, Edge, demo, and SQL put-away helpers, but `/orders/[id]` stamped one station onto every line. Mixed deliveries could not land Walk-in vs Line correctly without a second transfer.

## Change
- Domain: `buildReceiveLinesFromFormInputs` accepts `storageLocationIdsByItemId` and falls back to the shared `storageLocationId` default when a line override is blank.
- UI: default put-away chooser applies to all lines; each receive row has its own station chips (search still filters chips and keeps the selected station visible).
- Receive readiness requires a valid station on every line when locations exist.
- i18n EN / ES / zh-Hans for default + per-line labels; security/UI contract tests updated.

## Verification (passed on 8b14)
- `npm run typecheck`
- `npm test` — 366 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
