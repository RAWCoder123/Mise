# Receive put-away pgTAP coverage (2026-08-01)

## Completed

- Fast-forwarded `cursor/mise-product-inspection-d84d` from tip `cursor/mise-product-inspection-1b0f`.
- Added `supabase/tests/database/receive_supplier_order_putaway.test.sql` proving:
  - `service_receive_supplier_order_and_signals` is service_role-only
  - staff cannot receive through the service RPC
  - Walk-in put-away increases on-hand, restores Main, and lands quantity on Walk-in
  - station balances stay equal to restaurant on-hand
  - ledger metadata records put-away station id/name
  - cross-tenant and unknown storage locations are rejected
  - completed-order re-receive is `already_applied` / non-double-counting
  - omitting `storage_location_id` keeps stock on Main
- Wired static contract assertions in `tests/security.test.ts` and `tests/supplierOrderReceiving.test.ts`.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run security:backend`
- `npm run security:static`
- `npm run design:static`
- Docker `npm run supabase:test` still unavailable in this environment (suite is ready for local/hosted re-proof).

## Remaining

- Docker + hosted re-proof of the July/August migration chain.
- `schema.sql` dump refresh when Docker is available.
- Founder privacy/support HTTPS URLs, Apple/TestFlight, Auth redirect allowlist, live POS/Gmail.
