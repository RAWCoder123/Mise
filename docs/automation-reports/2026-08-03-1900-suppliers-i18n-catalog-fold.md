# Suppliers i18n catalog fold

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-a1ae`

## Gap

`/settings/suppliers` still carried a screen-local `supplierCopy` map for EN/ES/zh-Hans, while Team, Gmail, and Today already fold operator copy through `i18n/catalog.ts`. Mutation StatusNotice tone selection also lived inline, and save failures did not call `captureMiseError`.

## Change

- Fast-forwarded this branch from `origin/cursor/mise-product-inspection-0473` (team mutation StatusNotice tip).
- Added `settings.suppliers.*` keys to the shared EN/ES/zh-Hans catalogs.
- Replaced the screen-local locale map with `buildSupplierCopy(t)`.
- Extended `suppliersHubPresentation` with mutation busy/editable helpers and reason-specific notice tone mapping (`invalidEmail` → caution, `saved` → success, `saveError` → danger).
- Save failures now call `captureMiseError` and never surface raw exception text.
- Directory edits stay gated while the hub is not ready or any recipient save is in flight.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
