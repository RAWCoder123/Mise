# Order detail mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-2f1a`

## Gap

`/orders/[id]` already had soft-refresh and RetryNotice for load failures, plus StatusNotice for mutation outcomes, but notice tone selection and Gmail recovery mapping lived in screen-local helpers (`viewOnlyNotice`, `gmailConnectionRequiredNotice`, `orderSendErrorNotice`). Save, copy, place, send, and receive failures did not call `captureMiseError`.

## Change

- Fast-forwarded this branch from `origin/cursor/mise-product-inspection-a1ae` (suppliers i18n catalog fold tip).
- Extended `services/presentation/orderDetailPresentation.ts` with mutation busy/editable helpers, reason-specific notice copy (title + message + tone + optional recovery), and send-error reason resolution.
- `/orders/[id]` now maps note save/copy/place/send/receive outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans MessageKeys already present).
- Mutation and load failures call `captureMiseError` and never surface raw exception text.
- Draft edit and receive actions stay gated while a mutation is busy or the hub is not ready.
- Extended `tests/orderDetailPresentation.test.ts` and updated `tests/ordersUi.test.ts` for MessageKey map wiring.

## Verification

- `npm run typecheck` — passed
- `npm test` — 497 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
