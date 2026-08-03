# POS mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-68f8`

## Gap

`/settings/pos` already had soft-refresh and RetryNotice for load failures, but connect/import outcomes used plain `Text` messages, catch blocks were silent (no `captureMiseError`), live-mode provider attempts reused the demo-load error string, and busy gating was not shared through presentation helpers.

## Change

- Extended `services/presentation/posHubPresentation.ts` with mutation busy/editable helpers, reason-specific StatusNotice tone mapping, and CSV import outcome resolution.
- `/settings/pos` now maps demo connect, CSV import (mapped/unmapped/incompatible), validation, and live-provider-restricted outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans).
- Load/connect/import failures call `captureMiseError` and never surface raw exception text.
- Connect/import actions stay gated while any POS mutation is busy.
- Extended `tests/posHubPresentation.test.ts` for helpers and StatusNotice wiring.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
