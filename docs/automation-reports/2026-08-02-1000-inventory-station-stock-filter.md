# Inventory station stock-list filter (2026-08-02)

## Gap
Inventory Health showed per-station risk bars, but operators could not tap a station to narrow the stock list. Locating items by storage line still required opening each SKU.

## Change
- Presentation: `InventoryLocationHealthRow.stockedItemIds`, plus `resolveStationStockedItemIds` / `filterItemsByStationStock`.
- UI: `/inventory` station rows are selectable (toggle), filter the stock list with existing status + ranked search, and expose a clear control.
- i18n: EN / ES / zh-Hans station filter + empty-state copy.
- Tests: presentation unit coverage + security static contract.

## Proof
- `npm run typecheck` (pass)
- `npm test` (359 pass / 0 fail)
- `npm run security:backend` (pass)
- `npm run security:static` (pass)
- `npm run design:static` (pass)
- Docker `supabase:test` still unavailable in this environment.

## Follow-ups
- Docker/hosted re-proof after July/Aug migrations.
- Optional: ranked search on transfer location chips when restaurants accumulate many stations.
- Founder Auth redirect / privacy URLs; Apple/EAS/device QA; live POS/Gmail.
