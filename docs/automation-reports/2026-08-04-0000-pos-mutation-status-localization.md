# POS mutation StatusNotice localization + inventory/insights load telemetry

Date: 2026-08-04
Branch: `cursor/mise-product-inspection-81fb`

## Gap

`/settings/pos` already had soft-refresh and RetryNotice for load failures, but connect/import outcomes used plain `Text` messages, catch blocks were silent (no `captureMiseError`), live-mode provider attempts reused the demo-load error string, and busy gating was not shared through presentation helpers. `/inventory` and `/insights` soft-refresh + RetryNotice paths also swallowed load/refresh failures without telemetry.

## Change

- Reset this branch onto `origin/cursor/mise-product-inspection-caf3` (inventory detail mutation StatusNotice tip).
- Extended `services/presentation/posHubPresentation.ts` with mutation busy/editable helpers, `presentPosMutationNoticeCopy`, and `resolvePosCsvImportNoticeReason`.
- `/settings/pos` now maps demo/CSV/live-restricted outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans), never surfaces raw exception text, and calls `captureMiseError` for load/connect/import.
- Inventory hub load and Insights hub load/refresh failures call `captureMiseError` with flows `inventory` and `insights`.
- Extended `tests/posHubPresentation.test.ts`, `tests/inventoryHubPresentation.test.ts`, and `tests/insightsHubPresentation.test.ts`.

## Verification

- `npm run typecheck` — passed
- `npm test` — 514 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
