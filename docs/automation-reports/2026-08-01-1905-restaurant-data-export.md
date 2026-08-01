# Restaurant data export / portability

Date: 2026-08-01
Branch: `cursor/mise-product-inspection-7300`
Base tip: `2047b21` (fast-forwarded from `cursor/mise-product-inspection-4923`)

## Completed

1. **Domain serializer** — `services/domain/restaurantDataExport.ts` builds a versioned JSON export, redacts invite tokens, strips secret-like POS settings, sanitizes email connection rows, and caps POS sales to 90 days.
2. **Edge export path** — `export-restaurant-data` authenticates, reserves the restaurant-scoped firewall (owner/admin, 4/300s), loads tenant rows via service role after membership checks, audits, and returns the document.
3. **Demo path** — local demo repository serializes `DemoState` for the active restaurant without calling Edge.
4. **Settings UI** — owner/admin Export restaurant data copies JSON to the clipboard; staff/managers do not see the control.
5. **Security contracts** — migration allowlists the function, `verify_jwt = true`, static/backend gate coverage, and unit tests for redaction/role gates.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker/pgTAP execution and hosted staging re-proof remain environment-blocked in this workspace.

## Classification impact

Still **controlled pilot-ready code** pending Docker + hosted security gate re-run. Not App Store submission-ready (privacy/support URLs, Apple account actions, live POS/Gmail remain).
