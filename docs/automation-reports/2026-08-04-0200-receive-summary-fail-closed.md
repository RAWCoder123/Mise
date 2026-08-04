# Completed-order receive summary fail-closed (2026-08-04)

## Gap
`/orders/[id]` converted `fetchSupplierOrderReceiveSummary` failures into `null` via `.catch(() => null)`, then rendered the completed-order empty ledger copy. Operators could not tell load failure apart from a genuinely missing receive ledger, and discrepancy history stayed hidden without retry.

## Change
- Presentation helpers distinguish receive-summary load `ready` / `empty` / `unavailable`.
- Order detail captures `load_receive_summary` failures on initial load and post-receive refresh, keeps the order soft-available, and shows a localized RetryNotice instead of empty-ledger copy.
- EN / ES / zh-Hans copy under `orders.detail.receivedSummary.unavailable.*`.
- Tests cover load-state helpers, catalog coverage, and removal of the silent `.catch(() => null)` fallback.

## Verification
- `npm run typecheck`
- `npm test`
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
