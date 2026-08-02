# Completed-order receive discrepancy summary (2026-08-02)

## Gap
Receiving already recorded ordered-versus-received ledger metadata (and short-ship learning), but `/orders/[id]` hid that detail after status became `completed`. History-lane review could not show short-ships, overages, notes, or put-away stations.

## Change
- Domain: `buildCompletedSupplierOrderReceiveSummary` reconstructs a bounded read-only summary from receiving movements filtered by `supplier_order_id`.
- Application/repository: `fetchSupplierOrderReceiveSummary` + `fetchSupplierOrderReceiveMovements` (demo + hosted JSON metadata filter, max 100 lines).
- UI: completed orders on `/orders/[id]` render receive summary lines with discrepancy state, put-away station, and optional note.
- Demo: seed completed Regional Protein Co. order `…603` with a short chicken line and matched beef line so History has a realistic example.
- i18n: EN / ES / zh-Hans keys under `orders.detail.receivedSummary.*`.

## Verification (passed on 9a65)
- `npm run typecheck`
- `npm test` — 369 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`
- `npm run qa:routes`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.

## Classification
Controlled pilot-ready for this workflow in demo/local paths. Hosted RLS proof still depends on Docker/hosted re-run after recent July/Aug migrations.
