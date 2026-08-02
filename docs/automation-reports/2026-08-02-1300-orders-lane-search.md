# Orders lane ranked search (2026-08-02)

## Gap
`/orders` drafts, sent, and history lanes listed every supplier order without find. Long queues forced visual scanning across suppliers when opening, sending, or reviewing completed deliveries.

## Change
- Domain: `filterSupplierOrdersBySearch` + `SUPPLIER_ORDER_LANE_SEARCH_THRESHOLD` (5).
- Matches supplier name, order message, or operator note with the same ranking helpers as other find controls.
- UI: search when the active lane has ≥5 orders; empty-match state; query resets on restaurant or lane change.
- Recommendation find query now also clears on restaurant change (tenant hygiene).
- i18n EN / ES / zh-Hans; security static contract extended.

## Verification (passed on 17a5)
- `npm run typecheck`
- `npm test` — 364 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
