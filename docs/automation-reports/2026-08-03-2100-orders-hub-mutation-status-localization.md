# Orders hub mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-5b3e`

## Gap

`/orders` already had soft-refresh and RetryNotice for load failures, plus StatusNotice for mutation outcomes, but notice titles were tone-generic (`orders.status.*`) and approve/dismiss/undo/copy/place/send failures used silent `catch` blocks without `captureMiseError`. Send failures also lacked Gmail/supplier recovery actions that order detail already provided.

## Change

- Fast-forwarded this branch from `origin/cursor/mise-product-inspection-2f1a` (order detail mutation StatusNotice localization tip).
- Extended `services/presentation/ordersHubPresentation.ts` with mutation busy/editable helpers, reason-specific notice copy, and demo/Gmail send-success reason resolution (including plural variants).
- `/orders` now maps approve/dismiss/undo/copy/place/send outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans), reuses order-detail send-error helpers for Gmail recovery, and never surfaces raw exception text.
- Load and mutation failures call `captureMiseError` with `flow: "orders_hub"`.
- Extended `tests/ordersHubPresentation.test.ts` and updated `tests/ordersUi.test.ts` for MessageKey map wiring and capture coverage.

## Verification

- `npm run typecheck` — passed
- `npm test` — 501 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
