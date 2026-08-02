# Inventory list and count sheet ranked search (2026-08-02)

## Gap
Inventory list search used naive substring matching, and count sessions had no line filter. Waste “find item” reused the list search, so operators still missed near-name and supplier/category matches on large sheets.

## Change
- Domain: `filterInventoryItemsBySearch` in `services/domain/inventoryItemSearch.ts` ranks full lists (no picker limit) and optionally matches extra text such as coverage labels.
- UI: `/inventory` list/waste search uses the ranked helper; `/inventory/count` adds a count-sheet search that filters visible lines without mutating saved drafts.
- i18n: EN / ES / zh-Hans search hint and count empty-state copy.
- Tests: domain coverage + security static contract for list/count reuse.

## Proof
- `npm run typecheck`
- `npm test` (357 pass)
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `supabase:test` still unavailable in this environment.

## Follow-ups
- Docker/hosted re-proof after July/Aug migrations.
- Founder Auth redirect / privacy URLs; Apple/EAS/device QA; live POS/Gmail.
