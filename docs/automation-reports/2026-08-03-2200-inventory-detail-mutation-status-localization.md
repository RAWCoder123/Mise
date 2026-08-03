# Inventory detail mutation StatusNotice localization

Date: 2026-08-03
Branch: `cursor/mise-product-inspection-caf3`

## Gap

`/inventory/[id]` already had soft-refresh and RetryNotice for load failures, but save/waste/transfer/order/location mutations used plain `Text` status lines, silent `catch` blocks without `captureMiseError`, and a raw English regex for insufficient waste-station quantity. Operators could see unstructured failure text without reason-specific titles, and telemetry missed inventory-detail mutation failures.

## Change

- Fast-forwarded this branch from `origin/cursor/mise-product-inspection-5b3e` (Orders hub mutation StatusNotice localization tip).
- Extended `services/presentation/inventoryDetailPresentation.ts` with mutation notice reasons, tone mapping, and waste/transfer/save failure reason resolvers that never surface raw exception text.
- `/inventory/[id]` now maps save, add-to-order, waste, transfer, location-create, load, and permission outcomes through localized StatusNotice titles + bodies (EN/ES/zh-Hans).
- Load and mutation failures call `captureMiseError` with `flow: "inventory_detail"`.
- Added `tests/inventoryDetailPresentation.test.ts` and tightened waste UI wiring assertions.

## Verification

- `npm run typecheck` — passed
- `npm test` — 510 passed
- `npm run security:static` — passed
- `npm run security:backend` — passed
- `npm run design:static` — passed
- `npm run qa:routes` — passed

Docker `supabase:test` and hosted private-beta re-proof remain unavailable in this environment.
