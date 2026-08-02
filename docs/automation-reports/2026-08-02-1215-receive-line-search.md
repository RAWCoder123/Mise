# Supplier receive line ranked search (2026-08-02)

## Gap
Sent-order receive UI listed every linked recommendation without find. Large deliveries forced visual scanning; operators risked missing a line while entering quantities.

## Change
- Reuse `filterInventoryItemsBySearch` + `PURCHASE_RECOMMENDATION_SEARCH_THRESHOLD` on `/orders/[id]` receive rows.
- Match item name or supplier; filter is display-only so hidden lines keep entered quantities/notes and `receiveReady` still validates the full set.
- Reset receive-line and put-away queries on restaurant/order change.
- i18n EN / ES / zh-Hans; security static contract extended.

## Verification (passed on a8f6)
- `npm run typecheck`
- `npm test` — 363 passed
- `npm run security:static`
- `npm run security:backend`
- `npm run design:static`

Docker `supabase:test` and hosted staging re-proof remain environment-blocked in this run.
