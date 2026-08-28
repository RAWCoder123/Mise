# Suppliers i18n catalog fold + false-empty restore

Date: 2026-08-28  
Branch: `cursor/mise-suppliers-i18n-catalog`  
Base: `origin/main` @ `20b28e5`

## Gap

`/settings/suppliers` still used a screen-local `supplierCopy` EN/ES/zh-Hans map
instead of the shared `i18n/catalog.ts`. Soft-refresh failure also re-introduced a
false-empty claim: when `hubReady` was false, the directory still rendered
“No suppliers yet” and a `0 of 0 ready` count.

## Change

- Added `settings.suppliers.*` keys for EN, ES, and zh-Hans (including rename notices).
- Replaced `supplierCopy[locale]` with `buildSupplierCopy(t)`.
- Restored hubReady gating so empty-state and configured-count only render when ready.
- Capture load/save/rename failures via `captureMiseError`.

## Verification

- `npm run typecheck`
- `npm test` (supplierRecipients + localization parity)

## Out of scope

- Post-setup supplier create (#230)
- Inventory supplier reassignment (#228)
- Invite-gated Auth signup (founder Auth decision; keep `disable_signup`)
