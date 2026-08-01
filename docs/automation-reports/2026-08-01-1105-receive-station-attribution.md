# Receive station attribution (2026-08-01)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-84ed` from prior tip `cursor/mise-product-inspection-f5c0`.
- Optional per-line `storageLocationId` on supplier-order receive payloads (default Main).
- Domain put-away planner `planReceiveLocationPutaway` moves just-received quantity from Main onto the chosen station without changing restaurant on-hand.
- Demo and hosted receiving paths attribute station balances and ledger metadata (`storage_location_id` / `storage_location_name`).
- Migration `20260801110000_receive_supplier_order_storage_location.sql` updates service receive RPC + private put-away helper.
- Orders detail UI adds a put-away station chooser (en / es / zh-Hans).

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- `npm run qa:routes`

## Remaining

- Docker + hosted re-proof of the Aug 1 migration chain.
- Invite absolute share URL.
- Founder privacy/support HTTPS URLs, Apple/TestFlight, live POS/Gmail remain external blockers.
