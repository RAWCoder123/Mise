# Transfer location + orders review ranked search (2026-08-02)

## Gap
Operators with many storage stations had to scan full chip lists on inventory transfer and receive put-away. Long purchase recommendation queues on `/orders` also lacked item find beyond visual scanning.

## Change
- Domain: `filterStorageLocationsBySearch` (+ chip/recommendation search thresholds) in `inventoryItemSearch.ts`.
- Selected transfer/put-away location stays visible when the query does not match it.
- UI: ranked location search on inventory detail transfer choosers and order receive put-away when station count ≥ 5.
- UI: ranked recommendation find on `/orders` review queue (item, supplier, reason) when queue length ≥ 5.
- i18n: EN / ES / zh-Hans copy for location and recommendation search empty states.
- Tests: unit coverage for location ranking/pinning + security static contract.

## Proof
- `npm run typecheck` (pass)
- `npm test` (361 pass / 0 fail)
- `npm run security:backend` (pass)
- `npm run security:static` (pass)
- `npm run design:static` (pass)
- Docker `supabase:test` still unavailable in this environment.

## Follow-ups
- Docker/hosted re-proof after July/Aug migrations.
- Founder Auth redirect / privacy URLs; Apple/EAS/device QA; live POS/Gmail.
